import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import axios from 'axios';
import { Log } from '../logs/entities/log.entity';
import { Automation } from '../automations/entities/automation.entity';
import { IgAccountSnapshot } from '../ig-accounts/entities/ig-account-snapshot.entity';
import { IgAccountsService } from '../ig-accounts/ig-accounts.service';
import type { IgAccount } from '../ig-accounts/entities/ig-account.entity';

export type Range = 'today' | '7d' | '30d';

const TZ = 'Asia/Tashkent';
const TZ_OFFSET_MS = 5 * 3600_000; // O'zbekistonda yozgi vaqt yo'q — doim UTC+5
const DAY = 24 * 3600_000;

// Log turlari (webhook.service yozadigan nomlar)
const A_REPLY = 'Komment Javob';
const A_DM = 'Kommentdan DM';
const A_ASK = "Obuna so'rovi";
const A_MAIN = 'Asosiy DM (obunadan keyin)';
const COMMENT_ACTIONS = [A_REPLY, A_DM, A_ASK]; // komment kelganda yoziladiganlar

/** Meta xato kodlari → tushunarli sabab */
function errorReason(message: string | null): string {
  if (!message) return "Noma'lum xato";
  let e: any = null;
  try {
    e = JSON.parse(message)?.error;
  } catch {
    /* JSON emas — oddiy matn */
  }
  if (e) {
    const code = Number(e.code);
    const sub = Number(e.error_subcode);
    if (code === 10 && sub === 2534022) return 'DM oynasi yopiq (24 soatdan oshgan)';
    if (code === 190) return 'Token eskirgan yoki bekor qilingan';
    if ([4, 17, 32, 613, 80002, 80006].includes(code)) return 'Instagram limitiga urildi';
    if (code === 10 || code === 200) return "Ruxsat yo'q (ilova huquqlari)";
    if (code === 551 || /not available|does not exist/i.test(e.message ?? '')) return 'Foydalanuvchi yoki komment mavjud emas';
    if (/deleted/i.test(e.message ?? '')) return "Komment o'chirilgan";
    return String(e.message || `Xato kodi ${code}`).slice(0, 90);
  }
  if (/timeout|ECONN|ENOTFOUND|socket/i.test(message)) return 'Tarmoq xatosi';
  return message.slice(0, 90);
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  // Post rasmlari keshi (har safar Instagram'ga bormaslik uchun), 1 soat
  private readonly mediaCache = new Map<string, { at: number; data: any }>();

  constructor(
    @InjectRepository(Log) private readonly logs: Repository<Log>,
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
    @InjectRepository(IgAccountSnapshot) private readonly snaps: Repository<IgAccountSnapshot>,
    private readonly accounts: IgAccountsService,
  ) {}

  /** Davr chegaralari (Toshkent vaqti bo'yicha kun boshidan) va oldingi teng davr */
  private window(range: Range) {
    const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
    const now = Date.now();
    const localMidnight = Math.floor((now + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS;
    const start = new Date(localMidnight - (days - 1) * DAY);
    const end = new Date(localMidnight + DAY);
    const prevStart = new Date(start.getTime() - days * DAY);
    return { days, start, end, prevStart, prevEnd: start };
  }

  async build(acc: IgAccount, range: Range) {
    const w = this.window(range);
    const id = acc.id;

    const [cur, prev, series, funnel, heatmap, topUsers, errorRows, recent, byAutomation, byPost, followers] = await Promise.all([
      this.kpis(id, w.start, w.end),
      this.kpis(id, w.prevStart, w.prevEnd),
      this.series(id, w.start, w.end, range),
      this.funnel(id, w.start, w.end),
      this.heatmap(id, w.start, w.end),
      this.topUsers(id, w.start, w.end),
      this.logs.query(
        `SELECT message FROM logs WHERE "igAccountId" = $1 AND type <> 'success' AND "createdAt" >= $2 AND "createdAt" < $3
         ORDER BY "createdAt" DESC LIMIT 1000`,
        [id, w.start, w.end],
      ),
      this.logs.find({ where: { igAccountId: id }, order: { createdAt: 'DESC' }, take: 10 }),
      this.byAutomation(id, w.start, w.end),
      this.byPost(acc, w.start, w.end),
      this.followers(acc, w),
    ]);

    // Xato sabablari bo'yicha guruhlash
    const reasons = new Map<string, number>();
    for (const r of errorRows) {
      const key = errorReason(r.message);
      reasons.set(key, (reasons.get(key) ?? 0) + 1);
    }

    const change = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : Math.round(((a - b) / b) * 100));

    return {
      range,
      period: { start: w.start, end: w.end },
      account: { id: acc.id, username: acc.username },
      kpis: {
        replies: { value: cur.replies, prev: prev.replies, change: change(cur.replies, prev.replies) },
        dms: { value: cur.dms, prev: prev.dms, change: change(cur.dms, prev.dms) },
        successRate: {
          value: cur.total ? Math.round((cur.success / cur.total) * 100) : null,
          prev: prev.total ? Math.round((prev.success / prev.total) * 100) : null,
          total: cur.total,
        },
        newPeople: { value: cur.newPeople, prev: prev.newPeople, change: change(cur.newPeople, prev.newPeople) },
      },
      series,
      funnel,
      heatmap,
      topUsers,
      errors: {
        total: errorRows.length,
        reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, count]) => ({ reason, count })),
      },
      byAutomation,
      byPost,
      followers,
      recent: recent.map((r) => ({
        id: r.id, type: r.type, action: r.action, user: r.user, userMessage: r.userMessage,
        message: r.type === 'success' ? r.message : errorReason(r.message), createdAt: r.createdAt,
      })),
    };
  }

  private async kpis(id: number, start: Date, end: Date) {
    const [row] = await this.logs.query(
      `SELECT
         count(*) FILTER (WHERE type = 'success' AND action = $4)::int                AS replies,
         count(*) FILTER (WHERE type = 'success' AND action IN ($5, $6))::int         AS dms,
         count(*) FILTER (WHERE type = 'success')::int                                AS success,
         count(*)::int                                                                AS total
       FROM logs WHERE "igAccountId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3`,
      [id, start, end, A_REPLY, A_DM, A_MAIN],
    );
    // Yangi odam — bot u bilan BIRINCHI marta shu davrda ishlagan
    const [np] = await this.logs.query(
      `SELECT count(*)::int AS n FROM (
         SELECT "user", min("createdAt") AS first FROM logs
          WHERE "igAccountId" = $1 AND "user" IS NOT NULL GROUP BY "user"
       ) x WHERE first >= $2 AND first < $3`,
      [id, start, end],
    );
    return { ...row, newPeople: np.n };
  }

  /** Bugun — soatlar bo'yicha (24 ta), aks holda kunlar bo'yicha; bo'sh oraliqlar 0 bilan */
  private async series(id: number, start: Date, end: Date, range: Range) {
    const unit = range === 'today' ? 'hour' : 'day';
    const rows: any[] = await this.logs.query(
      `SELECT to_char(date_trunc('${unit}', "createdAt" AT TIME ZONE '${TZ}'), 'YYYY-MM-DD"T"HH24') AS b,
              count(*) FILTER (WHERE type = 'success' AND action = $4)::int          AS replies,
              count(*) FILTER (WHERE type = 'success' AND action IN ($5, $6))::int   AS dms,
              count(*) FILTER (WHERE type <> 'success')::int                         AS errors
       FROM logs WHERE "igAccountId" = $1 AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY 1`,
      [id, start, end, A_REPLY, A_DM, A_MAIN],
    );
    const map = new Map(rows.map((r) => [r.b, r]));
    const out: { bucket: string; replies: number; dms: number; errors: number }[] = [];
    const step = unit === 'hour' ? 3600_000 : DAY;
    for (let t = start.getTime(); t < end.getTime(); t += step) {
      const local = new Date(t + TZ_OFFSET_MS).toISOString(); // UTC+5 ni "lokal" sifatida o'qiymiz
      const key = `${local.slice(0, 10)}T${local.slice(11, 13)}`;
      const hit = map.get(key);
      out.push({ bucket: key, replies: hit?.replies ?? 0, dms: hit?.dms ?? 0, errors: hit?.errors ?? 0 });
    }
    return { unit, points: out };
  }

  private async funnel(id: number, start: Date, end: Date) {
    const [r] = await this.logs.query(
      `SELECT count(*) FILTER (WHERE action = $4)::int AS asked,
              count(*) FILTER (WHERE action = $5)::int AS converted
       FROM logs WHERE "igAccountId" = $1 AND type = 'success' AND "createdAt" >= $2 AND "createdAt" < $3`,
      [id, start, end, A_ASK, A_MAIN],
    );
    return { asked: r.asked, converted: r.converted, rate: r.asked ? Math.round((r.converted / r.asked) * 100) : null };
  }

  /** Hafta kuni (1=Du…7=Ya) × soat — ishlangan kommentlar soni */
  private async heatmap(id: number, start: Date, end: Date) {
    const rows: any[] = await this.logs.query(
      `SELECT extract(isodow FROM "createdAt" AT TIME ZONE '${TZ}')::int AS dow,
              extract(hour   FROM "createdAt" AT TIME ZONE '${TZ}')::int AS hour,
              count(DISTINCT coalesce("commentId", 'log-' || id))::int     AS n
       FROM logs WHERE "igAccountId" = $1 AND action = ANY($4) AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY 1, 2`,
      [id, start, end, COMMENT_ACTIONS],
    );
    return rows;
  }

  private async topUsers(id: number, start: Date, end: Date) {
    return this.logs.query(
      `SELECT "user",
              count(DISTINCT coalesce("commentId", 'log-' || id)) FILTER (WHERE action = ANY($4))::int AS comments,
              count(*) FILTER (WHERE type = 'success')::int AS handled
       FROM logs WHERE "igAccountId" = $1 AND "user" IS NOT NULL AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY "user" ORDER BY comments DESC, handled DESC LIMIT 5`,
      [id, start, end, COMMENT_ACTIONS],
    );
  }

  /** Qoidalar bo'yicha (automationId shu kundan boshlab yoziladi) */
  private async byAutomation(id: number, start: Date, end: Date) {
    const rows: any[] = await this.logs.query(
      `SELECT "automationId" AS aid,
              count(*) FILTER (WHERE type = 'success' AND action = $4)::int        AS replies,
              count(*) FILTER (WHERE type = 'success' AND action IN ($5, $6))::int AS dms,
              count(*) FILTER (WHERE type <> 'success')::int                       AS errors
       FROM logs WHERE "igAccountId" = $1 AND "automationId" IS NOT NULL AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY 1 ORDER BY (count(*)) DESC LIMIT 8`,
      [id, start, end, A_REPLY, A_DM, A_MAIN],
    );
    if (!rows.length) return [];
    const autos = await this.automations.find({ where: { id: In(rows.map((r) => r.aid)) } });
    const names = new Map(autos.map((a) => [a.id, { name: a.name, isActive: a.isActive }]));
    return rows.map((r) => ({
      id: r.aid,
      name: names.get(r.aid)?.name ?? "O'chirilgan qoida",
      isActive: names.get(r.aid)?.isActive ?? false,
      replies: r.replies, dms: r.dms, errors: r.errors,
    }));
  }

  /** Eng ko'p komment kelgan postlar — rasmi bilan (mediaId shu kundan boshlab yoziladi) */
  private async byPost(acc: IgAccount, start: Date, end: Date) {
    const rows: any[] = await this.logs.query(
      `SELECT "mediaId" AS mid, count(DISTINCT coalesce("commentId", 'log-' || id))::int AS comments,
              count(*) FILTER (WHERE type = 'success')::int AS handled
       FROM logs WHERE "igAccountId" = $1 AND "mediaId" IS NOT NULL AND action = ANY($4)
         AND "createdAt" >= $2 AND "createdAt" < $3
       GROUP BY 1 ORDER BY comments DESC LIMIT 5`,
      [acc.id, start, end, COMMENT_ACTIONS],
    );
    if (!rows.length || acc.status !== 'active') return rows.map((r) => ({ mediaId: r.mid, comments: r.comments, handled: r.handled }));
    let token: string | null = null;
    try {
      token = this.accounts.creds(acc).token;
    } catch {
      /* token ochilmadi — rasmlarsiz */
    }
    return Promise.all(
      rows.map(async (r) => ({ mediaId: r.mid, comments: r.comments, handled: r.handled, ...(token ? await this.media(r.mid, token) : {}) })),
    );
  }

  private async media(mediaId: string, token: string) {
    const hit = this.mediaCache.get(mediaId);
    if (hit && Date.now() - hit.at < 3600_000) return hit.data;
    try {
      const res = await axios.get(`https://graph.instagram.com/v21.0/${mediaId}`, {
        params: { fields: 'caption,media_type,media_url,thumbnail_url,permalink,timestamp', access_token: token },
        timeout: 15_000,
      });
      const d = res.data;
      const data = {
        caption: d.caption ? String(d.caption).slice(0, 120) : null,
        thumbnail: d.thumbnail_url || d.media_url || null,
        permalink: d.permalink || null,
        timestamp: d.timestamp || null,
      };
      this.mediaCache.set(mediaId, { at: Date.now(), data });
      return data;
    } catch {
      return {}; // post o'chirilgan yoki ruxsat yo'q — rasmsiz ko'rsatiladi
    }
  }

  /** Obunachilar: hozirgi son va davr ichidagi o'zgarish (kunlik snapshotlardan) */
  private async followers(acc: IgAccount, w: { start: Date; days: number }) {
    const fromDay = new Date(w.start.getTime() + TZ_OFFSET_MS - (w.days === 1 ? 6 * DAY : 0)).toISOString().slice(0, 10);
    const series = await this.snaps.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, "followersCount" AS value
       FROM ig_account_snapshots WHERE "igAccountId" = $1 AND day >= $2 ORDER BY day`,
      [acc.id, fromDay],
    );
    const [before] = await this.snaps.query(
      `SELECT "followersCount" AS value FROM ig_account_snapshots
        WHERE "igAccountId" = $1 AND day < $2 ORDER BY day DESC LIMIT 1`,
      [acc.id, fromDay],
    );
    const current = acc.followersCount ?? series.at(-1)?.value ?? null;
    const base = before?.value ?? series[0]?.value ?? null;
    return { current, delta: current != null && base != null ? current - base : null, series, since: fromDay };
  }
}
