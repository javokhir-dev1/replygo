import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * Akkauntning kunlik holati. Instagram API faqat HOZIRGI obunachilar sonini
 * beradi — o'sish grafigi uchun har kuni bittadan yozib boriladi.
 */
@Entity('ig_account_snapshots')
@Index(['igAccountId', 'day'], { unique: true })
export class IgAccountSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  igAccountId: number;

  // Toshkent vaqti bo'yicha sana (YYYY-MM-DD)
  @Column({ type: 'date' })
  day: string;

  @Column({ type: 'int', nullable: true })
  followersCount: number | null;

  @Column({ type: 'int', nullable: true })
  mediaCount: number | null;
}
