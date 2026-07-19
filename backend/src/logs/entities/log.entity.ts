import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('logs')
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

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
