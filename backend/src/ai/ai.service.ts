import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { In, Repository } from 'typeorm';
import { Queue } from 'bullmq';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { AiAnalysis } from './entities/ai-analysis.entity';
import { AI_QUEUE, JOB_ANALYZE } from './ai.constants';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import { InstagramMediaService, MediaItem } from '../instagram/instagram-media.service';
import { TelegramService } from '../telegram/telegram.service';
import { runClaude } from './claude-runner';
import { SYSTEM_PROMPT, mediaPrompt, profilePrompt } from './ai.prompts';
import { MEDIA_REPORT_SCHEMA, PROFILE_REPORT_SCHEMA } from './ai.schemas';
import * as prep from './media-prep';

const TZ = 'Asia/Tashkent';
const median = (xs: number[]) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
};
const local = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-CA', { timeZone: TZ }),
    weekday: d.toLocaleDateString('uz-UZ', { timeZone: TZ, weekday: 'long' }),
    hour: Number(d.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false })),
  };
};

/**
 * AI tahlil (lokal Claude CLI): bitta post yoki butun profil.
 *
 * Faqat AI_ALLOWED_USERS dagi foydalanuvchilar uchun — CLI egasining shaxsiy
 * Claude obunasi bilan ishlaydi, uni boshqa foydalanuvchilarga ochmaymiz.
 * Tahlillar navbatda birma-bir bajariladi (Whisper protsessorni band qiladi).
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger('AiAnalysis');
  // Shu jarayon qachon ishga tushgani. Worker onModuleInit'dan OLDIN ham ish
  // olishi mumkin — shuning uchun faqat bundan oldin boshlanganlar "osilgan" hisoblanadi.
  private readonly bootAt = new Date();

  constructor(
    @InjectRepository(AiAnalysis) private readonly repo: Repository<AiAnalysis>,
    @InjectQueue(AI_QUEUE) private readonly queue: Queue,
    private readonly accounts: IgAccountsService,
    private readonly media: InstagramMediaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Server qayta ishga tushganda yarim qolgan tahlillar "osilib" qolmasin */
  async onModuleInit() {
    const res = await this.repo
      .createQueryBuilder()
      .update()
      .set({ status: 'error', error: 'Server qayta ishga tushdi — tahlilni qayta boshlang', finishedAt: new Date() })
      .where('status = :st', { st: 'running' })
      .andWhere('("startedAt" IS NULL OR "startedAt" < :boot)', { boot: this.bootAt })
      .execute();
    if (res.affected) this.logger.warn(`${res.affected} ta yarim qolgan tahlil xato deb belgilandi`);
  }

  isAllowed(username: string | null | undefined) {
    const list = (process.env.AI_ALLOWED_USERS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    return !!username && list.includes(username.toLowerCase());
  }

  assertAllowed(username: string) {
    if (!this.isAllowed(username)) throw new ForbiddenException('AI tahlil bu akkaunt uchun yoqilmagan');
  }

  /** Yangi tahlil — shu narsa uchun navbatda/ishlayotgani bo'lsa o'shani qaytaradi */
  async start(userId: number, kind: 'media' | 'profile', mediaId: string | null) {
    const acc = await this.accounts.activeFor(userId);
    if (!acc) throw new NotFoundException('Avval Instagram akkauntni ulang');
    const existing = await this.repo.findOne({
      where: { userId, igAccountId: acc.id, kind, mediaId: mediaId ?? undefined, status: In(['queued', 'running']) as any },
    });
    if (existing) return existing;

    const a = await this.repo.save(
      this.repo.create({ userId, igAccountId: acc.id, kind, mediaId, status: 'queued', stage: 'Navbatda' }),
    );
    await this.queue.add(JOB_ANALYZE, { id: a.id }, { attempts: 1, removeOnComplete: 200, removeOnFail: 200 });
    return a;
  }

  async get(userId: number, id: number) {
    const a = await this.repo.findOne({ where: { id, userId } });
    if (!a) throw new NotFoundException('Tahlil topilmadi');
    return a;
  }

  /** Oxirgi tahlillar (shu akkaunt bo'yicha); mediaId berilsa — faqat o'sha post */
  async list(userId: number, kind?: 'media' | 'profile', mediaId?: string) {
    const acc = await this.accounts.activeFor(userId);
    if (!acc) return [];
    return this.repo.find({
      where: { userId, igAccountId: acc.id, ...(kind ? { kind } : {}), ...(mediaId ? { mediaId } : {}) },
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  private async stage(a: AiAnalysis, stage: string) {
    a.stage = stage;
    await this.repo.update({ id: a.id }, { stage });
  }

  /* ------------------------------ ishlov ------------------------------ */

  async process(jobId: unknown) {
    // Butun musbat son bo'lmasa — rad etamiz. TypeORM `id = NaN` shartini
    // e'tiborsiz qoldirib, BIRINCHI qatorni qaytarishi mumkin (sinovda shunday bo'ldi).
    const id = Number(jobId);
    if (!Number.isInteger(id) || id <= 0) {
      this.logger.warn(`Noto'g'ri tahlil ID: ${String(jobId)} — job o'tkazib yuborildi`);
      return;
    }
    const a = await this.repo.findOne({ where: { id } });
    if (!a || a.id !== id || a.status !== 'queued') return;
    a.status = 'running';
    await this.repo.update({ id }, { status: 'running', stage: 'Boshlandi', startedAt: new Date() });

    const dir = path.join(os.tmpdir(), 'replygo-ai', String(id));
    await fs.mkdir(dir, { recursive: true });
    const started = Date.now();
    try {
      const acc = await this.accounts.getForUser(a.userId, a.igAccountId);
      const creds = this.accounts.creds(acc);
      const r = a.kind === 'media' ? await this.runMedia(a, creds, dir) : await this.runProfile(a, creds, dir, acc.username);
      await this.repo.update(
        { id },
        {
          status: 'done', stage: null, result: r.output, meta: r.meta, model: r.model,
          costUsd: r.costUsd, durationMs: Date.now() - started, finishedAt: new Date(), error: null,
        } as any, // result/meta — simple-json; TypeORM'ning chuqur Partial tipi ularni tanimaydi
      );
      this.logger.log(`✅ Tahlil #${id} (${a.kind}) tayyor: ${Math.round((Date.now() - started) / 1000)} s`);
      await this.telegram
        .notifyUserText(a.userId, `🤖 <b>AI tahlil tayyor</b>\n${a.kind === 'profile' ? 'Profil skaneri' : 'Post tahlili'} · ball: ${r.output?.score ?? '—'}/10`)
        .catch(() => undefined);
    } catch (e: any) {
      this.logger.error(`Tahlil #${id} xato: ${e.message}`);
      await this.repo.update(
        { id },
        { status: 'error', stage: null, error: String(e.message).slice(0, 1000), durationMs: Date.now() - started, finishedAt: new Date() },
      );
    } finally {
      await prep.cleanup(dir);
    }
  }

  /** Bitta post: video → kadrlar + nutq, statistika, kommentlar, akkaunt bilan solishtirish */
  private async runMedia(a: AiAnalysis, creds: any, dir: string) {
    await this.stage(a, "Ma'lumot yig'ilmoqda");
    const det = await this.media.mediaDetails(creds, a.mediaId!);
    const item = det.item;
    const [insights, comments, all, profile] = await Promise.all([
      this.media.insights(creds, item),
      this.media.comments(creds, item.id, 50),
      this.media.allMedia(creds, 50).catch(() => [] as MediaItem[]),
      this.media.overview(creds, 30).then((o) => o.profile).catch(() => null),
    ]);

    // Akkauntdagi o'xshash postlar bilan solishtirish
    const peers = all.filter((m) => m.kind === item.kind && m.id !== item.id);
    const v = (m: MediaItem) => m.insights?.views ?? NaN;
    const ranked = [...all.filter((m) => m.kind === item.kind)].sort((x, y) => (v(y) || 0) - (v(x) || 0));
    const medViews = median(peers.map(v));
    const benchmark = {
      compared_with: `${peers.length} ta boshqa ${item.kind === 'REELS' ? 'reels' : 'post'}`,
      median_views: medViews,
      median_reach: median(peers.map((m) => m.insights?.reach ?? NaN)),
      median_likes: median(peers.map((m) => m.insights?.likes ?? m.likeCount ?? NaN)),
      median_shares: median(peers.map((m) => m.insights?.shares ?? NaN)),
      median_saved: median(peers.map((m) => m.insights?.saved ?? NaN)),
      rank_by_views: ranked.findIndex((m) => m.id === item.id) + 1 + ` / ${ranked.length}`,
      views_vs_median_pct: medViews && insights?.views != null ? Math.round(((insights.views - medViews) / medViews) * 100) : null,
    };

    // Vizual material
    const frameFiles: string[] = [];
    let videoDuration: number | null = null;
    let transcript: string | null = null;
    const isVideo = det.item.mediaType === 'VIDEO';
    if (isVideo && det.mediaUrl) {
      await this.stage(a, 'Video yuklanmoqda');
      const file = await prep.download(det.mediaUrl, path.join(dir, 'video.mp4'));
      await this.stage(a, 'Kadrlar ajratilmoqda');
      const f = await prep.frames(file, dir, { max: 24 });
      frameFiles.push(...f.frames);
      videoDuration = Math.round(f.duration);
      await this.stage(a, 'Nutq matnga aylantirilmoqda');
      transcript = (await prep.transcribe(file).catch((e) => {
        this.logger.warn(`Nutq tanilmadi: ${e.message}`);
        return null;
      }))?.text ?? null;
    } else if (det.mediaUrl || det.children.length) {
      await this.stage(a, 'Rasmlar yuklanmoqda');
      const parts = det.children.length ? det.children.slice(0, 10) : [{ mediaType: det.item.mediaType, url: det.mediaUrl, thumbnail: null }];
      let i = 0;
      for (const p of parts) {
        i++;
        if (p.mediaType === 'VIDEO' && p.url) {
          const file = await prep.download(p.url, path.join(dir, `part${i}.mp4`));
          const f = await prep.frames(file, dir, { max: 4 });
          for (const fr of f.frames) {
            const renamed = `slide${String(i).padStart(2, '0')}_${fr}`;
            await fs.rename(path.join(dir, fr), path.join(dir, renamed));
            frameFiles.push(renamed);
          }
        } else if (p.url) {
          const src = await prep.download(p.url, path.join(dir, `src${i}`));
          frameFiles.push(await prep.image(src, dir, `slide${String(i).padStart(2, '0')}.jpg`));
        }
      }
    }

    await this.stage(a, 'Claude tahlil qilmoqda');
    const lt = local(item.timestamp);
    const facts = {
      account: { username: profile?.username ?? null, followers: profile?.followers_count ?? null },
      media: {
        id: item.id, kind: item.kind, media_type: item.mediaType, published: `${lt.date} (${lt.weekday}, soat ${lt.hour}:00, Toshkent)`,
        video_duration_sec: videoDuration, slides: det.children.length || null, permalink: item.permalink,
      },
      metrics: {
        ...insights,
        ...(insights?.ig_reels_avg_watch_time != null ? { avg_watch_sec: Math.round(insights.ig_reels_avg_watch_time / 100) / 10 } : {}),
        ...(insights?.ig_reels_avg_watch_time != null && videoDuration
          ? { avg_watch_share_pct: Math.round((insights.ig_reels_avg_watch_time / 1000 / videoDuration) * 100) }
          : {}),
        likes: insights?.likes ?? item.likeCount, comments: insights?.comments ?? item.commentsCount,
      },
      account_benchmark: benchmark,
    };
    const r = await runClaude({
      cwd: dir,
      system: SYSTEM_PROMPT,
      prompt: mediaPrompt({ frames: frameFiles, facts, caption: item.caption, transcript, comments }),
      schema: MEDIA_REPORT_SCHEMA,
      timeoutMs: 15 * 60_000,
    });
    return {
      ...r,
      meta: { frames: frameFiles.length, transcriptChars: transcript?.length ?? 0, comments: comments.length, facts },
    };
  }

  /** Butun profil: barcha postlar jadvali + 30 kun + eng yaxshi/yomon videolar hook'i */
  private async runProfile(a: AiAnalysis, creds: any, dir: string, username: string | null) {
    await this.stage(a, "Postlar va statistika yig'ilmoqda");
    const [overview, all] = await Promise.all([this.media.overview(creds, 30), this.media.allMedia(creds, 100)]);

    const rows = all.map((m) => {
      const lt = local(m.timestamp);
      const i = m.insights ?? {};
      return {
        id: m.id, date: lt.date, weekday: lt.weekday, hour: lt.hour, kind: m.kind, type: m.mediaType,
        caption: (m.caption ?? '').replace(/\s+/g, ' ').slice(0, 140),
        views: i.views ?? null, reach: i.reach ?? null, likes: i.likes ?? m.likeCount, comments: i.comments ?? m.commentsCount,
        shares: i.shares ?? null, saved: i.saved ?? null,
        avg_watch_sec: i.ig_reels_avg_watch_time != null ? Math.round(i.ig_reels_avg_watch_time / 100) / 10 : null,
      };
    });
    const byKind = Object.fromEntries(
      ['REELS', 'FEED'].map((k) => {
        const list = rows.filter((r) => r.kind === k);
        return [k, { count: list.length, median_views: median(list.map((r) => r.views ?? NaN)), median_likes: median(list.map((r) => r.likes ?? NaN)) }];
      }),
    );

    // Namunalar: eng ko'p va eng kam ko'rilgan videolar (hook — birinchi soniyalar)
    const videos = all.filter((m) => m.mediaType === 'VIDEO' && m.insights?.views != null).sort((x, y) => y.insights!.views - x.insights!.views);
    const picks: { m: MediaItem; label: string }[] = [
      ...videos.slice(0, 3).map((m, i) => ({ m, label: `ENG KO'P KO'RILGAN #${i + 1} (id ${m.id}, ${m.insights!.views} ko'rish)` })),
      ...(videos.length > 6 ? videos.slice(-3) : videos.slice(3)).map((m, i) => ({ m, label: `ENG KAM KO'RILGAN #${i + 1} (id ${m.id}, ${m.insights!.views} ko'rish)` })),
    ];
    const samples: { label: string; frames: string[]; transcript: string | null }[] = [];
    let n = 0;
    for (const p of picks) {
      n++;
      await this.stage(a, `Videolar o'rganilmoqda (${n}/${picks.length})`);
      try {
        const det = await this.media.mediaDetails(creds, p.m.id);
        if (!det.mediaUrl) continue;
        const sub = path.join(dir, `v${n}`);
        await fs.mkdir(sub);
        const file = await prep.download(det.mediaUrl, path.join(sub, 'video.mp4'));
        const f = await prep.frames(file, sub, { max: 5, hookOnlySec: 8 });
        const tr = await prep.transcribe(file, { maxSec: 45 }).catch(() => null);
        await fs.rm(file, { force: true });
        samples.push({ label: p.label, frames: f.frames.map((x) => `v${n}/${x}`), transcript: tr?.text ?? null });
      } catch (e: any) {
        this.logger.warn(`Namuna ${p.m.id} o'tkazib yuborildi: ${e.message}`);
      }
    }

    await this.stage(a, 'Claude profilni tahlil qilmoqda');
    const facts = {
      profile: { username: overview.profile?.username ?? username, followers: overview.profile?.followers_count, following: overview.profile?.follows_count, media_count: overview.profile?.media_count },
      last_30_days: overview.totals,
      daily_reach_last_30_days: overview.daily,
      by_kind: byKind,
      posts: rows,
    };
    const r = await runClaude({
      cwd: dir,
      system: SYSTEM_PROMPT,
      prompt: profilePrompt({ facts, samples }),
      schema: PROFILE_REPORT_SCHEMA,
      timeoutMs: 25 * 60_000,
    });
    return {
      ...r,
      meta: {
        posts: rows.length,
        samples: samples.length,
        // Panelda top/weak postlarni rasm bilan ko'rsatish uchun
        postIndex: Object.fromEntries(all.map((m) => [m.id, { thumbnail: m.thumbnail, permalink: m.permalink, views: m.insights?.views ?? null, caption: (m.caption ?? '').slice(0, 80) }])),
      },
    };
  }
}
