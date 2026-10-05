import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Claude (lokal CLI) bajargan tahlil — bitta post yoki butun profil.
 * Natija (result) JSON sxema bo'yicha tuzilgan hisobot; tarix saqlanadi.
 */
@Entity('ai_analyses')
@Index(['userId', 'igAccountId', 'kind', 'mediaId'])
export class AiAnalysis {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'int' })
  igAccountId: number;

  // 'media' — bitta post/reels/istoriya | 'profile' — butun profil
  @Column({ type: 'varchar', length: 16 })
  kind: 'media' | 'profile';

  @Column({ type: 'varchar', nullable: true })
  mediaId: string | null;

  // queued → running → done | error
  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status: 'queued' | 'running' | 'done' | 'error';

  // Panelda ko'rinadigan bosqich: "Video yuklanmoqda", "Nutq matnga aylantirilmoqda"…
  @Column({ type: 'varchar', nullable: true })
  stage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  result: any;

  // Tahlil uchun yig'ilgan qisqa ma'lumot (statistika, kadrlar soni…) — hisobot yonida ko'rsatish uchun
  @Column({ type: 'simple-json', nullable: true })
  meta: any;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  // CLI hisoblagan taxminiy narx (obunada to'lanmaydi, faqat ma'lumot uchun)
  @Column({ type: 'double precision', nullable: true })
  costUsd: number | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn()
  createdAt: Date;

  // Worker ishni olgan vaqt — qayta ishga tushganda "osilib qolgan"larni aniqlash uchun
  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
