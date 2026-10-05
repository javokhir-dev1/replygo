import { Injectable, Logger } from '@nestjs/common';
import { igHttp as http, IG_BASE_URL as BASE_URL, IgCredentials } from './instagram.service';
import { IgRateLimitError } from './ig-errors';

/** Media turi bo'yicha so'raladigan statistika (Instagram API with Instagram Login) */
const METRICS: Record<'REELS' | 'FEED' | 'STORY', string[]> = {
  REELS: ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions',
    'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'],
  FEED: ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions', 'profile_visits', 'follows'],
  STORY: ['views', 'reach', 'replies', 'shares', 'total_interactions', 'navigation', 'profile_visits', 'follows'],
};

const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

const INSIGHTS_TTL_MS = 10 * 60_000; // har post uchun alohida so'rov — keshlaymiz
const OVERVIEW_TTL_MS = 10 * 60_000;
const CONCURRENCY = 4;
const CACHE_MAX = 5_000;

export type Insights = Record<string, number>;

export interface MediaItem {
  id: string;
  kind: 'REELS' | 'FEED' | 'STORY';
  mediaType: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  caption: string | null;
  thumbnail: string | null;
  permalink: string | null;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
  insights: Insights | null; // null — statistika olinmadi (ruxsat yoki xato)
}

/**
 * "Postlarim" bo'limi: media ro'yxati, istoriyalar va statistika.
 *
 * Instagram statistikani faqat har bir media uchun alohida beradi, shuning
 * uchun natija 10 daqiqa xotirada saqlanadi va bir vaqtda 4 tadan ortiq
 * so'rov yuborilmaydi — aks holda sahifa ochilishi limitni yeb qo'yadi.
 */
@Injectable()
export class InstagramMediaService {
  private readonly logger = new Logger(InstagramMediaService.name);
  private readonly cache = new Map<string, { exp: number; value: any }>();
  // Metrika rad etilsa Instagram ruxsat etilganlar ro'yxatini aytadi — eslab qolamiz
  private readonly allowed = new Map<string, string[]>();

  private cached<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (hit && hit.exp > Date.now()) return hit.value as T;
    if (hit) this.cache.delete(key);
    return undefined;
  }

  private store(key: string, value: any, ttl: number) {
    if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, { exp: Date.now() + ttl, value });
  }

  private kindOf(m: any): MediaItem['kind'] {
    if (m.media_product_type === 'STORY') return 'STORY';
    if (m.media_product_type === 'REELS') return 'REELS';
    return 'FEED';
  }

  private toItem(m: any, kind = this.kindOf(m)): MediaItem {
    return {
      id: m.id,
      kind,
      mediaType: m.media_type,
      caption: m.caption ?? null,
      thumbnail: m.thumbnail_url || (m.media_type === 'VIDEO' ? null : m.media_url) || null,
      permalink: m.permalink ?? null,
      timestamp: m.timestamp,
      likeCount: m.like_count ?? null,
      commentsCount: m.comments_count ?? null,
      insights: null,
    };
  }

  /** Bitta media statistikasi: rad etilgan metrikalarni olib tashlab qayta uriniladi */
  async insights(creds: IgCredentials, item: MediaItem): Promise<Insights | null> {
    const key = `ins:${item.id}`;
    const hit = this.cached<Insights | null>(key);
    if (hit !== undefined) return hit;

    let metrics = this.allowed.get(item.kind + item.mediaType) ?? METRICS[item.kind];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await http.get(`${BASE_URL}/${item.id}/insights`, {
          params: { metric: metrics.join(','), access_token: creds.token },
        });
        const out: Insights = {};
        for (const m of res.data?.data ?? []) {
          const v = m.values?.[0]?.value ?? m.total_value?.value;
          if (typeof v === 'number') out[m.name] = v;
        }
        this.store(key, out, INSIGHTS_TTL_MS);
        return out;
      } catch (e: any) {
        if (e instanceof IgRateLimitError) throw e;
        const msg: string = e?.response?.data?.error?.message || e.message;
        // "metric[0] must be one of the following values: a, b, c"
        const list = msg.match(/following values:\s*([a-z_,\s]+)/i)?.[1];
        if (attempt === 0 && list) {
          const ok = list.split(',').map((s) => s.trim()).filter(Boolean);
          const next = metrics.filter((m) => ok.includes(m));
          if (next.length) {
            this.allowed.set(item.kind + item.mediaType, next);
            metrics = next;
            continue;
          }
        }
        this.logger.warn(`Statistika olinmadi (${item.kind} ${item.id}): ${msg}`);
        this.store(key, null, 60_000); // xato natijani qisqa muddat eslab qolamiz
        return null;
      }
    }
    return null;
  }

  /** Ro'yxatga statistikani parallel (cheklangan) qo'shadi */
  private async withInsights(creds: IgCredentials, items: MediaItem[]) {
    let i = 0;
    const worker = async () => {
      while (i < items.length) {
        const it = items[i++];
        it.insights = await this.insights(creds, it);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    return items;
  }

  /** Postlar va Reels — sahifalab (Instagram cursor bilan) */
  async media(creds: IgCredentials, opts: { after?: string; limit?: number }) {
    const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
    const key = `media:${creds.accountId}:${opts.after ?? ''}:${limit}`;
    let page = this.cached<{ items: MediaItem[]; after: string | null }>(key);
    if (!page) {
      const res = await http.get(`${BASE_URL}/${creds.accountId}/media`, {
        params: { fields: MEDIA_FIELDS, limit, after: opts.after, access_token: creds.token },
      });
      page = {
        items: (res.data?.data ?? []).map((m: any) => this.toItem(m)),
        after: res.data?.paging?.next ? res.data?.paging?.cursors?.after ?? null : null,
      };
      this.store(key, page, 2 * 60_000);
    }
    // Keshdagi obyektni o'zgartirmaslik uchun nusxa
    const items = page.items.map((it) => ({ ...it }));
    await this.withInsights(creds, items);
    return { items, after: page.after };
  }

  /** AI tahlil uchun: bitta media to'liq (video/rasm manzili, karusel ichidagilar) */
  async mediaDetails(creds: IgCredentials, mediaId: string) {
    const res = await http.get(`${BASE_URL}/${mediaId}`, {
      params: {
        fields: `${MEDIA_FIELDS},children{media_type,media_url,thumbnail_url}`,
        access_token: creds.token,
      },
    });
    const m = res.data;
    const item = this.toItem(m);
    return {
      item,
      mediaUrl: (m.media_url as string) ?? null,
      children: ((m.children?.data ?? []) as any[]).map((c) => ({
        mediaType: c.media_type as string,
        url: (c.media_url as string) ?? null,
        thumbnail: (c.thumbnail_url as string) ?? null,
      })),
    };
  }

  /** AI tahlil uchun: post kommentlari (oxirgilari, ko'pi bilan `limit` ta) */
  async comments(creds: IgCredentials, mediaId: string, limit = 50) {
    try {
      const res = await http.get(`${BASE_URL}/${mediaId}/comments`, {
        params: { fields: 'text,timestamp,like_count,username', limit: Math.min(limit, 50), access_token: creds.token },
      });
      return ((res.data?.data ?? []) as any[]).map((c) => ({
        user: c.username ?? null,
        text: String(c.text ?? ''),
        likes: c.like_count ?? 0,
        at: c.timestamp,
      }));
    } catch (e: any) {
      if (e instanceof IgRateLimitError) throw e;
      this.logger.warn(`Kommentlar olinmadi (${mediaId}): ${e?.response?.data?.error?.message || e.message}`);
      return [];
    }
  }

  /** Profil skaneri uchun: barcha media (sahifalab, ko'pi bilan `max` ta) statistikasi bilan */
  async allMedia(creds: IgCredentials, max = 100) {
    const out: MediaItem[] = [];
    let after: string | undefined;
    while (out.length < max) {
      const page = await this.media(creds, { after, limit: 50 });
      out.push(...page.items);
      if (!page.after) break;
      after = page.after;
    }
    return out.slice(0, max);
  }

  /** Faol istoriyalar — Instagram API faqat oxirgi 24 soatdagilarini beradi */
  async stories(creds: IgCredentials) {
    const res = await http.get(`${BASE_URL}/${creds.accountId}/stories`, {
      params: { fields: MEDIA_FIELDS, access_token: creds.token },
    });
    const items = (res.data?.data ?? []).map((m: any) => this.toItem(m, 'STORY'));
    await this.withInsights(creds, items);
    return { items };
  }

  /** Akkaunt bo'yicha davr statistikasi + kunlik qamrov (grafik uchun) */
  async overview(creds: IgCredentials, days: number) {
    const d = Math.min(Math.max(days, 1), 30); // Instagram: bir so'rovda 30 kungacha
    const key = `ov:${creds.accountId}:${d}`;
    const hit = this.cached<any>(key);
    if (hit) return hit;

    const until = Math.floor(Date.now() / 1000);
    const since = until - d * 86_400 + 1;
    const totalsMetrics = ['views', 'reach', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves'];

    const [profile, totals, daily] = await Promise.all([
      http
        .get(`${BASE_URL}/${creds.accountId}`, {
          params: { fields: 'username,followers_count,follows_count,media_count', access_token: creds.token },
        })
        .then((r) => r.data)
        .catch(() => null),
      http
        .get(`${BASE_URL}/${creds.accountId}/insights`, {
          params: { metric: totalsMetrics.join(','), period: 'day', metric_type: 'total_value', since, until, access_token: creds.token },
        })
        .then((r) => {
          const out: Insights = {};
          for (const m of r.data?.data ?? []) {
            const v = m.total_value?.value;
            if (typeof v === 'number') out[m.name] = v;
          }
          return out;
        })
        .catch((e) => {
          if (e instanceof IgRateLimitError) throw e;
          this.logger.warn(`Akkaunt statistikasi olinmadi: ${e?.response?.data?.error?.message || e.message}`);
          return null;
        }),
      http
        .get(`${BASE_URL}/${creds.accountId}/insights`, {
          params: { metric: 'reach', period: 'day', since, until, access_token: creds.token },
        })
        .then((r) =>
          (r.data?.data?.[0]?.values ?? []).map((v: any) => ({ day: String(v.end_time).slice(0, 10), reach: v.value })),
        )
        .catch(() => []),
    ]);

    const value = { days: d, profile, totals, daily };
    this.store(key, value, OVERVIEW_TTL_MS);
    return value;
  }
}
