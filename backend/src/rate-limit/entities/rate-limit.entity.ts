import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('rate_limits')
@Index(['userId', 'mediaId'])
export class RateLimit {
  @PrimaryGeneratedColumn()
  id: number;

  // izoh muallifi ID
  @Column()
  userId: string;

  // qaysi post (media) ostidagi izoh
  @Column({ type: 'varchar', nullable: true })
  mediaId: string | null;

  @Column({ default: 0 })
  userReplyCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  userResetAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;
}
