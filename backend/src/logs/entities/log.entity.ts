import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  // Qaysi foydalanuvchining boti yozgan
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  // Dashboard uchun: qaysi akkaunt, qoida, post va komment.
  // Eski yozuvlarda bo'sh — statistika ularni "noma'lum" deb hisoblaydi.
  @Index()
  @Column({ type: 'int', nullable: true })
  igAccountId: number | null;

  @Column({ type: 'int', nullable: true })
  automationId: number | null;

  @Column({ type: 'varchar', nullable: true })
  mediaId: string | null;

  @Column({ type: 'varchar', nullable: true })
  commentId: string | null;

  // 'success' | 'error'
  @Column({ default: 'success' })
  @Index()
  type: string;

  // masalan: 'Komment Javob' | 'Kommentdan DM'
  @Column()
  action: string;

  // bot yuborgan matn (qisqartirilgan)
  @Column({ type: 'text', nullable: true })
  message: string;

  // izoh muallifi (username yoki id)
  @Column({ nullable: true })
  user: string;

  // foydalanuvchining asl izohi
  @Column({ type: 'text', nullable: true })
  userMessage: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
