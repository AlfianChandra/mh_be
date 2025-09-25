// transcription.service.js
import dotenv from "dotenv";
dotenv.config({ silent: true });

import Mode from "../models/mode.model.js";
import registry from "../utils/serviceregistry.utils.js";
import WebSocket from "ws";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

// =======================
// State & Config
// =======================

const targetSocket = {
  audio: {
    delta: "tcript:result:delta",
    completed: "tcript:result:completed",
  },
  mic: {
    delta: "tcript:mic:result:delta",
    completed: "tcript:mic:result:completed",
  },
};

const wsMap = new Map(); // socketId -> WebSocket (OpenAI Realtime)
const audioStates = new Map(); // socketId -> { socket, ready, targetResponse }
const isProcessing = new Map(); // (opsional) guard pemrosesan

// Reconnect, ping & queue
const reconnectAttempts = new Map(); // socketId -> number
const reconnectTimers = new Map(); // socketId -> Timeout
const pingIntervals = new Map(); // socketId -> Interval
const audioQueues = new Map(); // socketId -> { chunks: Buffer[], bytes: number }

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 500;
const MAX_QUEUE_BYTES = 1_000_000; // 1MB per client, sesuaikan

// NB: Model realtime di URL; model STT di session.update (input_audio_transcription)
const openAiUrl =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17";

// =======================
// Utils: ping/keepalive
// =======================

function schedulePing(ws, socketId) {
  clearInterval(pingIntervals.get(socketId));
  const id = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
      } catch {}
    }
  }, 20_000);
  pingIntervals.set(socketId, id);
}

function clearPing(socketId) {
  const id = pingIntervals.get(socketId);
  if (id) clearInterval(id);
  pingIntervals.delete(socketId);
}

// =======================
// Utils: reconnect logic
// =======================

function scheduleReconnect(socketId, lang = "id") {
  // Kalau client (Socket.IO) sudah putus, gak perlu reconnect
  if (!audioStates.has(socketId)) return;

  const attempt = (reconnectAttempts.get(socketId) || 0) + 1;
  reconnectAttempts.set(socketId, attempt);

  const jitter = Math.floor(Math.random() * 300);
  const delay =
    Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1)) + jitter;

  clearTimeout(reconnectTimers.get(socketId));
  const t = setTimeout(async () => {
    try {
      console.log(
        `[OpenAI WS] reconnect attempt ${attempt} for ${socketId}...`
      );
      await getOrCreateWs(socketId, lang); // tunggu sampai 'open'
      reconnectAttempts.set(socketId, 0);
      flushAudioQueue(socketId);

      const st = audioStates.get(socketId);
      st?.socket?.emit?.("tcript:status", { status: "reconnected" });
    } catch (e) {
      // coba lagi
      scheduleReconnect(socketId);
    }
  }, delay);

  reconnectTimers.set(socketId, t);

  const st = audioStates.get(socketId);
  st?.socket?.emit?.("tcript:status", {
    status: "reconnecting",
    attempt,
    delay,
  });
}

// =======================
// Utils: audio queue
// =======================

function initAudioQueue(socketId) {
  if (!audioQueues.has(socketId)) {
    audioQueues.set(socketId, { chunks: [], bytes: 0 });
  }
}

function enqueueAudio(socketId, buf) {
  initAudioQueue(socketId);
  const q = audioQueues.get(socketId);

  while (q.bytes + buf.length > MAX_QUEUE_BYTES && q.chunks.length) {
    const old = q.chunks.shift();
    q.bytes -= old.length;
  }

  q.chunks.push(buf);
  q.bytes += buf.length;
}

function flushAudioQueue(socketId) {
  const ws = wsMap.get(socketId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const q = audioQueues.get(socketId);
  if (!q || q.chunks.length === 0) return;

  console.log(
    `[OpenAI WS] flushing ${q.chunks.length} chunks (${q.bytes} bytes) for ${socketId}`
  );

  for (const buf of q.chunks) {
    ws.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: buf.toString("base64"),
      })
    );
  }

  q.chunks = [];
  q.bytes = 0;
}

// =======================
// OpenAI Realtime WS Factory
// =======================

async function getOrCreateWs(socketId, lang = "id") {
  let ws = wsMap.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) return ws;
  const langStr = lang === "id" ? "Bahasa Indonesia" : "English";
  const mode = await Mode.find({});
  const OPENAI_API_KEY =
    mode.length > 0
      ? mode[0].mode === "dev"
        ? process.env.OPENAI_API_KEY_MODE_DEV
        : process.env.OPENAI_API_KEY_MODE_PROD
      : process.env.OPENAI_API_KEY_MODE_DEV;

  ws = new WebSocket(openAiUrl, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  wsMap.set(socketId, ws);
  ws.setMaxListeners(50);

  const engPrompt =
    "Translate to English. If there is a foreign language, translate to English. Do not repeat the prompt";
  const indPrompt =
    "Terjemahkan ke Bahasa Indonesia. Kalo ada bahasa asing, terjemahin ke Bahasa Indonesia. Jangan mengulang prompt";
  // --- OPEN ---
  ws.on("open", () => {
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text"],
        instructions: lang === "id" ? indPrompt : engPrompt,
        input_audio_format: "pcm16", // rekomendasi model STT
        input_audio_transcription: {
          model: "gpt-4o-transcribe",
          prompt: lang === "id" ? indPrompt : engPrompt,
          language: lang, // biar langsung diarahkan ke bahasa Indonesia
        },
        // Voice Activity Detection
        turn_detection: {
          type: "server_vad",
          threshold: 0.8,
          prefix_padding_ms: 400,
          silence_duration_ms: 150,
          create_response: false,
          interrupt_response: false,
        },
      },
    };

    ws.send(JSON.stringify(sessionConfig));
  });

  // --- MESSAGE ---
  ws.on("message", (raw) => {
    const data = JSON.parse(raw.toString());

    // FIXED: Ambil socket dan targetResponse dari audioStates berdasarkan socketId
    const state = audioStates.get(socketId);
    const socket = state?.socket;
    const currentTargetResponse = state?.targetResponse;

    // Debug tipe event:
    // console.log('[OpenAI WS]', data.type);

    if (data.type === "conversation.item.input_audio_transcription.delta") {
      // FIXED: Emit ke socket yang tepat dengan targetResponse per-socket
      if (currentTargetResponse && socket) {
        socket.emit(targetSocket[currentTargetResponse].delta, data.delta);
      }
    } else if (
      data.type === "conversation.item.input_audio_transcription.completed"
    ) {
      // FIXED: Emit ke socket yang tepat dengan targetResponse per-socket
      if (currentTargetResponse && socket) {
        socket.emit(
          targetSocket[currentTargetResponse].completed,
          data.transcript
        );
      }
    } else if (data.type === "error") {
      console.error("[OpenAI WS] error event payload:", data);
      // biarkan close yang memicu reconnect kalau fatal
    }
  });

  // --- ERROR ---
  ws.on("error", (err) => {
    console.error(`[OpenAI WS] error for ${socketId}:`, err);
    // beberapa error tidak menutup socket; 'close' yang akan trigger reconnect
  });

  // --- CLOSE ---
  ws.on("close", (code, reason) => {
    console.log(`[OpenAI WS] closed for ${socketId} (code=${code})`);
    clearPing(socketId);
    wsMap.delete(socketId);
    scheduleReconnect(socketId, lang);
  });

  // Tunggu siap (sukses open atau error)
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("WS connect timeout")), 10_000);
    ws.once("open", () => {
      clearTimeout(t);
      resolve();
    });
    ws.once("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  return ws;
}

// =======================
// Kirim audio (PCM16 mono 24k)
// =======================

function appendPcm16(socketId, pcm16Buffer) {
  const ws = wsMap.get(socketId);

  // Jika belum OPEN, antrekan & biar auto flush saat terkoneksi
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    enqueueAudio(socketId, Buffer.from(pcm16Buffer));
    return;
  }

  const b64 = Buffer.from(pcm16Buffer).toString("base64");
  if (!b64 || b64.length === 0) return;

  ws.send(
    JSON.stringify({
      type: "input_audio_buffer.append",
      audio: b64,
    })
  );
}

// =======================
// Socket.IO listener
// =======================

registry.waitFor("transcriptionns", { timeoutMs: 5000 }).then((io) => {
  io.use(useSocketAuth);

  io.on("connection", async (socket) => {
    console.log(`[TRANSCRIPTION] client connected: ${socket.id}`);
    const language = socket.handshake.auth.language || "id";
    console.log(`[TRANSCRIPTION] language for ${socket.id}: ${language}`);
    audioStates.set(socket.id, { socket, ready: false, targetResponse: null });
    initAudioQueue(socket.id);

    // pastikan WS realtime siap
    try {
      await getOrCreateWs(socket.id, language);
      audioStates.get(socket.id).ready = true;
      socket.emit("tcript:status", { status: "ready" });
    } catch (e) {
      console.error(`[TRANSCRIPTION] WS init failed: ${e.message}`);
      socket.emit("tcript:error", {
        message: "init-failed",
        detail: e.message,
      });
    }

    // REMOVED: activeSocket = socket; // ini yang bikin masalah!

    // Terima audio dari client (ArrayBuffer PCM16 mono @24k)
    socket.on("tcript:audiobuffer", (data) => {
      try {
        let buf;
        if (data instanceof ArrayBuffer) {
          buf = Buffer.from(new Uint8Array(data));
        } else if (ArrayBuffer.isView(data)) {
          buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        } else if (Buffer.isBuffer(data)) {
          buf = data;
        } else if (typeof data === "string") {
          // kalau ada yang mengirim base64 string
          buf = Buffer.from(data, "base64");
        } else {
          console.warn(
            "[TRANSCRIPTION] Unknown audio payload type:",
            typeof data
          );
          return;
        }

        if (!buf || buf.length === 0) return;

        // FIXED: Set targetResponse per-socket
        const state = audioStates.get(socket.id);
        if (state) state.targetResponse = "audio";

        appendPcm16(socket.id, buf);
      } catch (err) {
        console.error(`[TRANSCRIPTION] Audio error for ${socket.id}:`, err);
      }
    });

    socket.on("tcript:micbuffer", (data) => {
      try {
        let buf;
        if (data instanceof ArrayBuffer) {
          buf = Buffer.from(new Uint8Array(data));
        } else if (ArrayBuffer.isView(data)) {
          buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        } else if (Buffer.isBuffer(data)) {
          buf = data;
        } else if (typeof data === "string") {
          // kalau ada yang mengirim base64 string
          buf = Buffer.from(data, "base64");
        } else {
          console.warn(
            "[TRANSCRIPTION] Unknown audio payload type:",
            typeof data
          );
          return;
        }

        if (!buf || buf.length === 0) return;

        // FIXED: Set targetResponse per-socket
        const state = audioStates.get(socket.id);
        if (state) state.targetResponse = "mic";

        appendPcm16(socket.id, buf);
      } catch (err) {
        console.error(`[TRANSCRIPTION] Audio error for ${socket.id}:`, err);
      }
    });

    // (Opsional) Manual commit: tidak dipakai saat server_vad aktif
    socket.on("tcript:force_commit", () => {
      const ws = wsMap.get(socket.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
    });

    // Cleanup saat client disconnect
    socket.on("disconnect", () => {
      console.log(`[TRANSCRIPTION] client disconnected: ${socket.id}`);

      // tutup WS realtime
      const ws = wsMap.get(socket.id);
      try {
        ws?.close();
      } catch {}
      wsMap.delete(socket.id);

      // bersih state
      audioStates.delete(socket.id);
      isProcessing.delete(socket.id);

      // stop reconnect & ping
      clearTimeout(reconnectTimers.get(socket.id));
      reconnectTimers.delete(socket.id);
      clearPing(socket.id);

      // bersihkan queue & counter
      audioQueues.delete(socket.id);
      reconnectAttempts.delete(socket.id);
    });
  });
});
