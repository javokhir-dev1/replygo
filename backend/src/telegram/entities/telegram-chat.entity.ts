import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Loglarni qabul qiladigan Telegram chatlar.
 *
 * Chat egasiga panel orqali bog'lanadi: Sozlamalar → "Telegram'ni ulash"
 * bir martalik havola beradi (t.me/<bot>?start=<kod>). Bitta foydalanuvchida
 * bir nechta chat bo'lishi mumkin (shaxsiy + jamoa guruhi).
 */
@Entity('telegram_chats')
export class TelegramChat {
  // Guruh ID'lari manfiy va 64-bit bo'ladi — varchar eng xavfsizi
  @PrimaryColumn({ type: 'varchar' })
  chatId: string;

  // Qaysi ReplyGo foydalanuvchisiga tegishli (loglar faqat shu egasiniki keladi)
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  // Ko'rsatish uchun: username yoki guruh nomi
  @Column({ type: 'varchar', nullable: true })
  title: string;

  // /stop yuborilsa false bo'ladi — yozuv o'chirilmaydi, tarix saqlanadi
  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
