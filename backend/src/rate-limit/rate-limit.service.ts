import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RateLimit } from './entities/rate-limit.entity';

@Injectable()
export class RateLimitService {
  constructor(
    @InjectRepository(RateLimit)
    private repo: Repository<RateLimit>,
  ) {}

  private whereFor(userId: string, mediaId?: string) {
    const where: any = { userId };
    where.mediaId = mediaId ? mediaId : IsNull();
    return where;
  }

  /** Bir foydalanuvchiga cooldown ichida perUserLimit dan ortiq javob bermaymiz */
  async canReply(
    userId: string,
    perUserLimit = 10,
    mediaId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const now = new Date();
    const record = await this.repo.findOne({ where: this.whereFor(userId, mediaId) });
    if (!record) return { allowed: true };

    const resetAt = record.userResetAt ? new Date(record.userResetAt) : null;
    const cooldownOver = !resetAt || now >= resetAt;
    if (cooldownOver) return { allowed: true };

    if (record.userReplyCount >= perUserLimit) {
      const remainingHr = ((resetAt.getTime() - now.getTime()) / 3_600_000).toFixed(1);
      return {
        allowed: false,
        reason: `${userId} limitga yetdi, ${remainingHr} soatdan keyin davom etadi`,
      };
    }
    return { allowed: true };
  }

  async recordReply(userId: string, cooldownHours = 24, mediaId?: string): Promise<void> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + cooldownHours * 3_600_000);
    let record = await this.repo.findOne({ where: this.whereFor(userId, mediaId) });

    if (!record) {
      record = this.repo.create({
        userId,
        mediaId: mediaId ?? null,
        userReplyCount: 1,
        userResetAt: resetAt,
        lastSentAt: now,
      });
    } else {
      const cooldownOver = !record.userResetAt || now >= new Date(record.userResetAt);
      if (cooldownOver) {
        record.userReplyCount = 1;
        record.userResetAt = resetAt;
      } else {
        record.userReplyCount += 1;
      }
      record.lastSentAt = now;
    }
    await this.repo.save(record);
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  randomDelay(minMs = 5000, maxMs = 10000): Promise<void> {
    return this.delay(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
  }
}
