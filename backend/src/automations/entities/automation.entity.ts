import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('automations')
export class Automation {
  @PrimaryGeneratedColumn()
  id: number;

  // Egasi. nullable — eski (bitta-adminli) qatorlar ko'chirish paytida egaga biriktiriladi
  @Index()
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  // Qaysi Instagram akkaunt uchun (foydalanuvchida bir nechta bo'lishi mumkin)
  @Index()
  @Column({ type: 'int', nullable: true })
  igAccountId: number | null;

  @Column()
  name: string;

  // 'any' = har qanday izoh | 'keyword' = faqat kalit so'zli
  @Column({ default: 'any' })
  triggerType: 'any' | 'keyword';

  @Column({ type: 'simple-json', default: '[]' })
  keywords: string[];

  // --- Izohga ochiq javob ---
  @Column({ default: true })
  replyEnabled: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  replyTemplates: string[];

  // --- DM (shaxsiy xabar) ---
  @Column({ default: false })
  dmEnabled: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  dmTemplates: string[];

  // DM tagidagi URL tugmalar (barcha shablonlar uchun)
  @Column({ type: 'simple-json', default: '[]' })
  dmButtons: { title: string; url: string }[];

  // --- Majburiy obunani tekshirish ---
  // Yoqilsa: asosiy DM yuborishdan oldin foydalanuvchi obunasi tekshiriladi
  @Column({ default: false })
  followCheckEnabled: boolean;

  // Dastlabki so'rov xabari (tugma bosishga undaydi).
  // DIQQAT: default qiymatda apostrof bo'lsa Postgres CREATE/ALTER buziladi,
  // shuning uchun nullable + fallback kodda beriladi.
  @Column({ type: 'text', nullable: true })
  followAskMessage: string;

  // Dastlabki so'rov tugmasi nomi
  @Column({ type: 'text', nullable: true })
  followAskButton: string;

  // Obuna bo'lmagan foydalanuvchiga ko'rsatiladigan xabar
  @Column({ type: 'text', nullable: true })
  followFailMessage: string;

  // Qayta tekshirish tugmasi nomi
  @Column({ type: 'text', nullable: true })
  followFailButton: string;

  // --- Postlar ---
  // 'all' = barcha postlar | 'specific' = tanlangan postlar
  @Column({ default: 'all' })
  postScope: 'all' | 'specific';

  @Column({ type: 'simple-json', default: '[]' })
  postIds: string[];

  // UI uchun post ma'lumotlari: [{id, caption, thumbnail}]
  @Column({ type: 'simple-json', default: '[]' })
  postData: { id: string; caption?: string; thumbnail?: string }[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
