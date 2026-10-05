import { Logger } from '@nestjs/common';
import { run } from './media-prep';

const logger = new Logger('ClaudeCli');

/**
 * Lokal Claude Code CLI'ni headless rejimda chaqiradi (egasining obunasi bilan).
 *
 * Xavfsizlik — Claude begona matnni (caption, komment, nutq) o'qiydi:
 *   --restricted         buyruq/kod bajaruvchi vositalar va WebFetch yo'q,
 *                        sozlama fayllari e'tiborsiz, fayllar faqat ish papkasida
 *   --tools Read         faqat o'qish (kadrlarni ko'rish uchun)
 *   --strict-mcp-config  MCP serverlar yuklanmaydi
 *   --json-schema        javob faqat sxema bo'yicha
 * Bundan tashqari bola jarayonga backend'ning maxfiy env'i (baza, tokenlar)
 * BERILMAYDI — faqat CLI ishlashi uchun kerakli o'zgaruvchilar.
 */
export async function runClaude(opts: {
  cwd: string;
  prompt: string;
  system: string;
  schema: object;
  timeoutMs: number;
}): Promise<{ output: any; costUsd: number | null; model: string | null; durationMs: number | null; turns: number | null }> {
  const bin = process.env.CLAUDE_BIN || 'claude';
  const model = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
  const effort = process.env.CLAUDE_EFFORT || 'high';

  const env: NodeJS.ProcessEnv = {};
  for (const k of ['HOME', 'PATH', 'USER', 'LANG', 'LC_ALL', 'TERM', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME', 'XDG_DATA_HOME', 'TMPDIR']) {
    if (process.env[k]) env[k] = process.env[k];
  }

  const args = [
    '-p',
    '--restricted',
    '--strict-mcp-config',
    '--tools', 'Read',
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',
    '--model', model,
    '--effort', effort,
    '--output-format', 'json',
    '--system-prompt', opts.system,
    '--json-schema', JSON.stringify(opts.schema),
  ];

  // Prompt stdin orqali — argument uzunligi chegarasiga urilmaslik uchun
  const { stdout } = await run(bin, args, { cwd: opts.cwd, env, timeoutMs: opts.timeoutMs, stdin: opts.prompt });
  let d: any;
  try {
    d = JSON.parse(stdout);
  } catch {
    throw new Error(`Claude javobi JSON emas: ${stdout.slice(0, 300)}`);
  }
  if (d.is_error || d.subtype !== 'success') {
    throw new Error(`Claude xato: ${d.subtype ?? ''} ${String(d.result ?? d.api_error_status ?? '').slice(0, 300)}`.trim());
  }
  const output = d.structured_output ?? (() => {
    try {
      return JSON.parse(d.result);
    } catch {
      return null;
    }
  })();
  if (!output) throw new Error('Claude tuzilgan javob qaytarmadi');
  logger.log(`Claude tugatdi: ${d.num_turns} qadam, ${Math.round((d.duration_ms ?? 0) / 1000)} s`);
  return {
    output,
    costUsd: typeof d.total_cost_usd === 'number' ? d.total_cost_usd : null,
    model: Object.keys(d.modelUsage ?? {})[0] ?? model,
    durationMs: d.duration_ms ?? null,
    turns: d.num_turns ?? null,
  };
}
