import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from '../logs/entities/log.entity';
import { Automation } from '../automations/entities/automation.entity';

// Barcha sanalar Toshkent vaqtida hisoblanadi — "bugun" foydalanuvchi
// ko'rgan kun bilan mos tushsin (server UTC da bo'lsa ham).
const TZ = 'Asia/Tashkent';

export interface StatsResponse {
  totals: { all: number; success: number; error: number; successRate: number };
  today: { all: number; success: number; error: number };
  week: { all: number; success: number; error: number };
  byAction: { action: string; success: number; error: number }[];
  daily: { day: string; success: number; error: number }[];
  automations: { total: number; active: number };
  recent: {
    id: number;
    type: string;
    action: string;
    user: string | null;
    userMessage: string | null;
    message: string | null;
    createdAt: Date;
  }[];
}

@Injectable()
export class TelegramStatsService {
  constructor(
    @InjectRepository(Log) private readonly logs: Repository<Log>,
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
  ) {}

  /** Faqat bitta foydalanuvchining ma'lumotlari */
  async build(userId: number): Promise<StatsResponse> {
    const u = Number(userId); // SQL'ga faqat butun son tushadi
    const [totals, today, week, byAction, daily, autoTotal, autoActive, recent] =
      await Promise.all([
        this.counts(u, ''),
        this.counts(u, `AND ("createdAt" AT TIME ZONE '${TZ}')::date = (now() AT TIME ZONE '${TZ}')::date`),
        this.counts(u, `AND "createdAt" >= now() - interval '7 days'`),
        this.byAction(u),
        this.daily(u),
        this.automations.count({ where: { userId: u } }),
        this.automations.count({ where: { userId: u, isActive: true } }),
        this.logs.find({ where: { userId: u }, order: { createdAt: 'DESC' }, take: 20 }),
      ]);

    return {
      totals: {
        ...totals,
        successRate: totals.all ? Math.round((totals.success / totals.all) * 100) : 0,
      },
      today,
      week,
      byAction,
      daily,
      automations: { total: autoTotal, active: autoActive },
      recent: recent.map((r) => ({
        id: r.id,
        type: r.type,
        action: r.action,
        user: r.user ?? null,
        userMessage: r.userMessage ?? null,
        message: r.message ?? null,
        createdAt: r.createdAt,
      })),
    };
  }

  // `extra` — faqat shu fayldagi o'zgarmas SQL qismlari (foydalanuvchi matni emas);
  // userId esa parametr ($1) sifatida beriladi.
  private async counts(userId: number, extra: string) {
    const [row] = await this.logs.query(
      `SELECT count(*)::int AS all,
              count(*) FILTER (WHERE type = 'success')::int AS success,
              count(*) FILTER (WHERE type <> 'success')::int AS error
       FROM logs WHERE "userId" = $1 ${extra}`,
      [userId],
    );
    return { all: row.all ?? 0, success: row.success ?? 0, error: row.error ?? 0 };
  }

  private byAction(userId: number) {
    return this.logs.query(
      `SELECT action,
              count(*) FILTER (WHERE type = 'success')::int AS success,
              count(*) FILTER (WHERE type <> 'success')::int AS error
       FROM logs WHERE "userId" = $1 GROUP BY action ORDER BY count(*) DESC`,
      [userId],
    );
  }

  /** Oxirgi 14 kun — WebApp dagi ustunli grafik uchun */
  private daily(userId: number) {
    return this.logs.query(
      `SELECT to_char(("createdAt" AT TIME ZONE '${TZ}')::date, 'YYYY-MM-DD') AS day,
              count(*) FILTER (WHERE type = 'success')::int AS success,
              count(*) FILTER (WHERE type <> 'success')::int AS error
       FROM logs
       WHERE "userId" = $1 AND "createdAt" >= now() - interval '14 days'
       GROUP BY 1 ORDER BY 1`,
      [userId],
    );
  }
}
