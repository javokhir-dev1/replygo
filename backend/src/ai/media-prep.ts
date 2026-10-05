import { spawn } from 'child_process';
import { createWriteStream, promises as fs } from 'fs';
import * as path from 'path';
import axios from 'axios';

/**
 * Video/rasmni Claude uchun tayyorlash: yuklab olish → kadrlar (ffmpeg) → nutq (Whisper).
 * Hammasi lokal, vaqtinchalik ish papkasida; tahlildan keyin papka o'chiriladi.
 */

const MAX_DOWNLOAD_BYTES = 300 * 1024 * 1024;

export const tools = {
  ffmpeg: () => process.env.FFMPEG_BIN || 'ffmpeg',
  ffprobe: () => process.env.FFPROBE_BIN || 'ffprobe',
  whisperPython: () => process.env.WHISPER_PYTHON || '',
  whisperScript: () => path.resolve(__dirname, '../../scripts/transcribe.py'),
};

/** Buyruqni shell'siz ishga tushiradi; vaqt chegarasi bilan */
export function run(cmd: string, args: string[], opts: { timeoutMs: number; env?: NodeJS.ProcessEnv; cwd?: string; stdin?: string }) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(cmd)}: ${Math.round(opts.timeoutMs / 1000)} s ichida tugamadi`));
    }, opts.timeoutMs);
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(cmd)} xato (${code}): ${stderr.trim().slice(-500)}`));
    });
    if (opts.stdin) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
}

export async function download(url: string, dest: string) {
  const res = await axios.get(url, { responseType: 'stream', timeout: 120_000, maxContentLength: MAX_DOWNLOAD_BYTES });
  let size = 0;
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest);
    res.data.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_DOWNLOAD_BYTES) {
        res.data.destroy();
        reject(new Error('Fayl juda katta (300 MB dan oshdi)'));
      }
    });
    res.data.pipe(out);
    out.on('finish', () => resolve());
    out.on('error', reject);
    res.data.on('error', reject);
  });
  return dest;
}

export async function duration(file: string): Promise<number | null> {
  try {
    const { stdout } = await run(tools.ffprobe(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { timeoutMs: 30_000 });
    const d = Number(stdout.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Videodan kadrlar: boshidan zichroq (hook muhim), keyin teng oraliqda.
 * Fayl nomida soniya bor (f_000.0s.jpg) — Claude vaqtni biladi.
 */
export async function frames(video: string, dir: string, opts: { max: number; hookOnlySec?: number }) {
  const dur = (await duration(video)) ?? 60;
  const end = opts.hookOnlySec ? Math.min(dur, opts.hookOnlySec) : dur;
  const times = new Set<number>();
  // Birinchi 3 soniya: 0, 1, 2 — hook
  for (const t of [0, 1, 2]) if (t < end) times.add(t);
  const rest = Math.max(opts.max - times.size, 0);
  const from = Math.min(3, end);
  for (let i = 0; i < rest; i++) {
    const t = from + ((end - from) * (i + 0.5)) / rest;
    if (t < end) times.add(Math.round(t * 10) / 10);
  }
  const out: string[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    const name = `f_${t.toFixed(1).padStart(5, '0')}s.jpg`;
    try {
      await run(tools.ffmpeg(), ['-nostdin', '-v', 'error', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', 'scale=480:-2', '-q:v', '4', path.join(dir, name)], { timeoutMs: 60_000 });
      out.push(name);
    } catch {
      /* oxirgi kadrlar ba'zan chiqmaydi — o'tkazib yuboramiz */
    }
  }
  return { frames: out, duration: dur };
}

/** Rasmni Claude o'qiy oladigan o'lchamga keltiradi */
export async function image(src: string, dir: string, name: string) {
  await run(tools.ffmpeg(), ['-nostdin', '-v', 'error', '-i', src, '-vf', "scale='min(1080,iw)':-2", '-q:v', '3', path.join(dir, name)], { timeoutMs: 60_000 });
  return name;
}

/** Nutq → matn (lokal Whisper). Sozlanmagan bo'lsa null */
export async function transcribe(video: string, opts: { maxSec?: number } = {}) {
  const py = tools.whisperPython();
  if (!py) return null;
  let input = video;
  if (opts.maxSec) {
    input = `${video}.head.wav`;
    await run(tools.ffmpeg(), ['-nostdin', '-v', 'error', '-y', '-i', video, '-t', String(opts.maxSec), '-vn', '-ac', '1', '-ar', '16000', input], { timeoutMs: 120_000 });
  }
  const { stdout } = await run(py, [tools.whisperScript(), input], { timeoutMs: 15 * 60_000 });
  const r = JSON.parse(stdout.trim().split('\n').pop() || '{}');
  return { text: String(r.text ?? ''), language: r.language ?? null, duration: r.duration ?? null };
}

export async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
}
