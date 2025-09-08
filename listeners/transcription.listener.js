// transcription.service.js
import dotenv from "dotenv";
dotenv.config({ silent: true });
import Mode from "../models/mode.model.js";
import registry from "../utils/serviceregistry.utils.js";
import WebSocket from "ws";
import { useSocketAuth } from "../middlewares/authverifier.socket.middleware.js";

// ⬇️ NEW: composable audio
import { createAudioProcessor } from "../composables/audioProcessor.js";

// =======================
// State & Config
// =======================
let activeSocket = null;
let targetResponse = "";
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
const audioStates = new Map(); // socketId -> { socket, ready }
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
function scheduleReconnect(socketId) {
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
      await getOrCreateWs(socketId);
      reconnectAttempts.set(socketId, 0);
      flushAudioQueue(socketId);
      const st = audioStates.get(socketId);
      st?.socket?.emit?.("tcript:status", { status: "reconnected" });
    } catch (e) {
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
async function getOrCreateWs(socketId) {
  let ws = wsMap.get(socketId);
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

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

  // --- OPEN ---
  ws.on("open", () => {
    // ⬇️ aktifkan ping
    schedulePing(ws, socketId);

    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text"],
        instructions:
          "Transkripsi verbatim ke bahasa Indonesia. Kalo ada bahasa asing, terjemahin ke bahasa indonesia",
        input_audio_format: "pcm16", // output processor: PCM16 mono 24k

        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "id",
        },

        // VAD server: auto segment; no response creation
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
    const state = audioStates.get(socketId);
    const socket = state?.socket;

    if (data.type === "conversation.item.input_audio_transcription.delta") {
      activeSocket?.emit?.(targetSocket[targetResponse].delta, data.delta);
    } else if (
      data.type === "conversation.item.input_audio_transcription.completed"
    ) {
      activeSocket?.emit?.(
        targetSocket[targetResponse].completed,
        data.transcript
      );
    } else if (data.type === "error") {
      console.error("[OpenAI WS] error event payload:", data);
    }
  });

  // --- ERROR ---
  ws.on("error", (err) => {
    console.error(`[OpenAI WS] error for ${socketId}:`, err);
  });

  // --- CLOSE ---
  ws.on("close", (code, reason) => {
    console.log(`[OpenAI WS] closed for ${socketId} (code=${code})`);
    clearPing(socketId);
    wsMap.delete(socketId);
    scheduleReconnect(socketId);
  });

  // Tunggu siap
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
// Helpers
// =======================
function normalizeToBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data));
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (typeof data === "string") {
    // base64
    return Buffer.from(data, "base64");
  }
  return null;
}

// =======================
// Socket.IO listener
// =======================
registry.waitFor("transcriptionns", { timeoutMs: 5000 }).then((io) => {
  io.use(useSocketAuth);
  io.on("connection", async (socket) => {
    console.log(`[TRANSCRIPTION] client connected: ${socket.id}`);
    audioStates.set(socket.id, { socket, ready: false });
    initAudioQueue(socket.id);

    // default meta (boleh dioverride lewat tcript:meta)
    let sysRate = 48000;
    let sysCh = 2; // system/share audio umumnya 48k stereo
    let micRate = 48000;
    let micCh = 1; // mic umumnya 48k mono

    // ⬇️ NEW: buat 2 processor (system & mic)
    const sysProcessor = createAudioProcessor({
      targetSampleRate: 24000,
      targetChannels: 1,
      frameMs: 20,
      bundleFrames: 5, // 100ms/chunk
      agc: { enabled: false }, // system audio: no AGC
      onChunk: (buf) => appendPcm16(socket.id, buf),
    });

    const micProcessor = createAudioProcessor({
      targetSampleRate: 24000,
      targetChannels: 1,
      frameMs: 20,
      bundleFrames: 5,
      agc: {
        enabled: true,
        targetRms: 0.12,
        maxGain: 5.0,
        attack: 0.08,
        release: 0.25,
      },
      onChunk: (buf) => appendPcm16(socket.id, buf),
    });

    // pastikan WS realtime siap
    try {
      await getOrCreateWs(socket.id);
      audioStates.get(socket.id).ready = true;
      socket.emit("tcript:status", { status: "ready" });
    } catch (e) {
      console.error(`[TRANSCRIPTION] WS init failed: ${e.message}`);
      socket.emit("tcript:error", {
        message: "init-failed",
        detail: e.message,
      });
    }

    activeSocket = socket;

    // OPTIONAL: frontend bisa kirim meta
    // { sysRate, sysCh, micRate, micCh }
    socket.on("tcript:meta", (meta = {}) => {
      if (Number.isFinite(meta.sysRate)) sysRate = meta.sysRate | 0;
      if (Number.isFinite(meta.sysCh)) sysCh = meta.sysCh | 0;
      if (Number.isFinite(meta.micRate)) micRate = meta.micRate | 0;
      if (Number.isFinite(meta.micCh)) micCh = meta.micCh | 0;
      socket.emit("tcript:status", {
        status: "meta-updated",
        sysRate,
        sysCh,
        micRate,
        micCh,
      });
    });

    // Terima system audio
    socket.on("tcript:audiobuffer", (data) => {
      try {
        const buf = normalizeToBuffer(data);
        if (!buf || buf.length === 0) return;
        targetResponse = "audio";
        // convert & kirim
        sysProcessor.pushRawPCM16(buf, sysRate, sysCh);
      } catch (err) {
        console.error(`[TRANSCRIPTION] Audio error for ${socket.id}:`, err);
      }
    });

    // Terima mic audio
    socket.on("tcript:micbuffer", (data) => {
      try {
        const buf = normalizeToBuffer(data);
        if (!buf || buf.length === 0) return;
        targetResponse = "mic";
        micProcessor.pushRawPCM16(buf, micRate, micCh);
      } catch (err) {
        console.error(`[TRANSCRIPTION] Mic error for ${socket.id}:`, err);
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

      try {
        sysProcessor.flush();
      } catch {}
      try {
        micProcessor.flush();
      } catch {}

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
