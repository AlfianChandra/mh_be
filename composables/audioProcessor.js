// composables/audio-processor.js
// ESM module
import { spawn } from "node:child_process";
import { Readable } from "node:stream";

let ffmpegPath = null;
try {
  // opsional (buat decode webm/ogg/mp3)
  ffmpegPath = (await import("ffmpeg-static")).default;
} catch {
  /* optional */
}

/**
 * @typedef {Object} AudioProcessorOptions
 * @property {number} [targetSampleRate=24000]
 * @property {number} [targetChannels=1]
 * @property {number} [frameMs=20]         // ukuran frame dasar
 * @property {number} [bundleFrames=5]     // 5*20ms = 100ms/chunk
 * @property {{enabled:boolean,targetRms?:number,maxGain?:number,attack?:number,release?:number}} [agc]
 * @property {(buf:Buffer)=>void} onChunk  // callback PCM16 mono 24kHz siap kirim
 * @property {number} [assumeInputSampleRate=24000] // kalau meta rate nggak ada
 */
const DEFAULTS = {
  targetSampleRate: 24000,
  targetChannels: 1,
  frameMs: 20,
  bundleFrames: 5,
  assumeInputSampleRate: 24000,
  agc: {
    enabled: false,
    targetRms: 0.12, // ~ -18 dBFS
    maxGain: 6.0, // 6x
    attack: 0.08, // 80 ms
    release: 0.25, // 250 ms
  },
};

/**
 * Buat processor per-koneksi (per socket).
 * Pemakaian umum:
 *   const p = createAudioProcessor({ onChunk: (buf)=> appendPcm16(socketId, buf) })
 *   p.pushRawPCM16(buf, 48000, 2) // dari system audio 48k stereo -> jadi PCM16 mono 24k
 */
export function createAudioProcessor(opts) {
  const cfg = {
    ...DEFAULTS,
    ...opts,
    agc: { ...DEFAULTS.agc, ...(opts?.agc ?? {}) },
  };
  if (typeof cfg.onChunk !== "function") {
    throw new Error("onChunk callback wajib diisi.");
  }

  // buffer kerja internal dalam Float32 (post mixdown & resample)
  /** @type {Float32Array[]} */
  const outChunks = [];
  /** @type {Float32Array} */ let outCarry = new Float32Array(0);

  const frameSamples = Math.round(cfg.targetSampleRate * (cfg.frameMs / 1000));
  const bundleSamples = frameSamples * cfg.bundleFrames;

  // State AGC
  let agcGain = 1.0;
  let lastRms = 0.0;

  function _appendOutFloat32(f32) {
    if (f32.length === 0) return;
    if (outCarry.length === 0) {
      outCarry = f32;
    } else {
      const merged = new Float32Array(outCarry.length + f32.length);
      merged.set(outCarry, 0);
      merged.set(f32, outCarry.length);
      outCarry = merged;
    }

    while (outCarry.length >= bundleSamples) {
      const chunk = outCarry.subarray(0, bundleSamples);
      const rest = outCarry.subarray(bundleSamples);
      // AGC (opsional)
      const processed = cfg.agc.enabled ? _applyAgc(chunk) : chunk;

      // convert ke PCM16 & emit
      const buf = float32ToPCM16Buffer(processed);
      cfg.onChunk(buf);

      // shift
      outCarry = new Float32Array(rest.length);
      outCarry.set(rest, 0);
    }
  }

  function _applyAgc(f32) {
    // RMS
    let sum = 0;
    for (let i = 0; i < f32.length; i++) {
      sum += f32[i] * f32[i];
    }
    const rms = Math.sqrt(sum / f32.length);
    lastRms = rms;

    const tgt = cfg.agc.targetRms;
    let desired = tgt > 0 ? tgt / Math.max(rms, 1e-9) : 1.0;
    desired = Math.min(desired, cfg.agc.maxGain);

    // attack/release smoothing
    const frameDur = (cfg.frameMs * cfg.bundleFrames) / 1000; // detik
    const atk = Math.exp(-frameDur / Math.max(cfg.agc.attack, 1e-3));
    const rel = Math.exp(-frameDur / Math.max(cfg.agc.release, 1e-3));
    if (desired > agcGain) {
      agcGain = agcGain * atk + desired * (1 - atk);
    } else {
      agcGain = agcGain * rel + desired * (1 - rel);
    }

    // apply & soft clip
    const out = new Float32Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      let s = f32[i] * agcGain;
      // soft clip sederhana
      if (s > 1) s = 2 / 3 + (s - 1) / (1 + (s - 1) ** 2);
      if (s < -1) s = -(2 / 3) + (s + 1) / (1 + (s + 1) ** 2);
      out[i] = Math.max(-1, Math.min(1, s));
    }
    return out;
  }

  /** ======== PUBLIC API ======== */

  /** Push PCM16 little-endian */
  function pushRawPCM16(
    buf,
    sampleRate = cfg.assumeInputSampleRate,
    channels = 1
  ) {
    if (!Buffer.isBuffer(buf)) {
      throw new Error("pushRawPCM16 butuh Buffer.");
    }
    if (buf.length % 2 !== 0) return; // safety
    const i16 = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    // Int16 -> Float32, mixdown kalau stereo
    let f32 = int16ToFloat32(i16);
    if (channels > 1) f32 = mixdownToMono(f32, channels);
    // resample kalau perlu
    const r = sampleRate;
    if (r !== cfg.targetSampleRate) {
      f32 = resampleLinear(f32, r, cfg.targetSampleRate);
    }
    _appendOutFloat32(f32);
  }

  /** Push Float32Array interleaved [-1..1] */
  function pushFloat32(float32, sampleRate, channels = 1) {
    let f32 = float32;
    if (channels > 1) f32 = mixdownToMono(f32, channels);
    if (sampleRate !== cfg.targetSampleRate) {
      f32 = resampleLinear(f32, sampleRate, cfg.targetSampleRate);
    }
    // clamp
    for (let i = 0; i < f32.length; i++) {
      if (f32[i] > 1) f32[i] = 1;
      else if (f32[i] < -1) f32[i] = -1;
    }
    _appendOutFloat32(f32);
  }

  /** Push WAV (Buffer RIFF/WAVE) */
  function pushWavBuffer(wavBuf) {
    const meta = parseWavHeader(wavBuf);
    if (!meta) throw new Error("WAV tidak valid.");
    const { channels, sampleRate, dataOffset, dataLength, bitsPerSample } =
      meta;
    if (bitsPerSample !== 16) throw new Error("WAV harus 16-bit PCM.");
    const pcm = wavBuf.subarray(dataOffset, dataOffset + dataLength);
    pushRawPCM16(pcm, sampleRate, channels);
  }

  /**
   * Decode via ffmpeg (webm/ogg/mp3/mp4). Bisa Buffer/Readable/path.
   * Butuh dependency: ffmpeg-static
   */
  function pushCompressed(input, inputMimeOrPath = "data") {
    if (!ffmpegPath) throw new Error("ffmpeg-static belum terinstall.");
    const ff = spawn(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        // Input
        ...(Buffer.isBuffer(input)
          ? ["-f", "matroska", "-i", "pipe:0"]
          : ["-i", typeof input === "string" ? input : "pipe:0"]),
        // Output PCM 24k mono s16le
        "-ac",
        String(cfg.targetChannels),
        "-ar",
        String(cfg.targetSampleRate),
        "-acodec",
        "pcm_s16le",
        "-f",
        "s16le",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    // feed input kalau Buffer/Readable
    if (Buffer.isBuffer(input)) {
      ff.stdin.write(input);
      ff.stdin.end();
    } else if (input instanceof Readable) {
      input.pipe(ff.stdin);
    } else if (typeof input === "string") {
      // path file: stdin nggak dipakai
    } else {
      ff.kill("SIGKILL");
      throw new Error("Tipe input ffmpeg tidak dikenali.");
    }

    ff.stdout.on("data", (chunk) => {
      // chunk sudah s16le mono 24k => langsung pass
      pushRawPCM16(chunk, cfg.targetSampleRate, cfg.targetChannels);
    });
    ff.on("close", () => {
      /* done */
    });
    ff.on("error", (e) => {
      /* bubble up silent */
    });
  }

  /** flush sisa buffer (opsional) */
  function flush() {
    if (outCarry.length > 0) {
      const processed = cfg.agc.enabled ? _applyAgc(outCarry) : outCarry;
      cfg.onChunk(float32ToPCM16Buffer(processed));
      outCarry = new Float32Array(0);
    }
  }

  return {
    pushRawPCM16,
    pushFloat32,
    pushWavBuffer,
    pushCompressed,
    flush,
    getStats: () => ({ frameSamples, bundleSamples, agcGain, lastRms }),
  };
}

/* ====================== Helpers ====================== */

function int16ToFloat32(i16) {
  const out = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) {
    out[i] = Math.max(-1, Math.min(1, i16[i] / 32768));
  }
  return out;
}

function float32ToPCM16Buffer(f32) {
  const buf = Buffer.allocUnsafe(f32.length * 2);
  let off = 0;
  for (let i = 0; i < f32.length; i++) {
    let s = f32[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    const v = Math.round(s * 32767);
    buf.writeInt16LE(v, off);
    off += 2;
  }
  return buf;
}

// Mixdown interleaved Float32 ke mono
function mixdownToMono(f32Interleaved, channels) {
  if (channels === 1) return f32Interleaved;
  const frames = Math.floor(f32Interleaved.length / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channels; ch++) {
      sum += f32Interleaved[i * channels + ch];
    }
    out[i] = sum / channels;
  }
  return out;
}

// Resampler linear (cepat & cukup buat speech)
function resampleLinear(input, srcRate, dstRate) {
  if (srcRate === dstRate) return input;
  const ratio = dstRate / srcRate;
  const newLen = Math.floor(input.length * ratio);
  const out = new Float32Array(newLen);
  let pos = 0;
  for (let i = 0; i < newLen; i++) {
    const srcPos = i / ratio;
    const iPos = Math.floor(srcPos);
    const frac = srcPos - iPos;
    const s0 = input[iPos] ?? 0;
    const s1 = input[iPos + 1] ?? s0;
    out[i] = s0 + (s1 - s0) * frac;
    pos += ratio;
  }
  return out;
}

// Parsir header WAV minimal
function parseWavHeader(buf) {
  if (buf.length < 44) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let fmt = null,
    data = null;

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      const audioFormat = buf.readUInt16LE(chunkStart + 0);
      const channels = buf.readUInt16LE(chunkStart + 2);
      const sampleRate = buf.readUInt32LE(chunkStart + 4);
      const bitsPerSample = buf.readUInt16LE(chunkStart + 14);
      fmt = { audioFormat, channels, sampleRate, bitsPerSample };
    } else if (chunkId === "data") {
      data = { dataOffset: chunkStart, dataLength: chunkSize };
      break;
    }
    offset = chunkStart + chunkSize;
  }

  if (!fmt || !data) return null;
  if (fmt.audioFormat !== 1) return null; // PCM
  return { ...fmt, ...data };
}
