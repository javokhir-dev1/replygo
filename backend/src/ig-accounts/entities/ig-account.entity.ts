import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Foydalanuvchiga ulangan Instagram professional akkaunti.
 *
 * Bitta foydalanuvchida bir nechta akkaunt bo'lishi mumkin; lekin bitta
 * Instagram akkaunt — faqat bitta foydalanuvchida (aks holda webhook kimga
 * tegishli ekani noaniq bo'lardi).
 *
 * Uzilganda qator o'chirilmaydi (status = 'disconnected', token tozalanadi):
 * qoidalar va statistika saqlanadi, qayta ulanganda hammasi joyiga qaytadi.
 */
@Entity('ig_accounts')
export class IgAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'int' })
  userId: number;

  // Instagram professional akkaunt ID'si (1784...). Webhook'dagi entry.id va
  // komment muallifining from.id si aynan shu bilan solishtiriladi.
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  igUserId: string;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'text', nullable: true })
  profilePictureUrl: string | null;

  // AES-256-GCM bilan shifrlangan uzoq muddatli token (common/secret-box).
  // Uzilgan akkauntda bo'sh satr.
  @Column({ type: 'text' })
  tokenEnc: string;

  // Ro'yxatda har safar Instagram API'ga bormaslik uchun keshlangan qiymatlar
  // (kunlik snapshot va akkaunt tekshiruvida yangilanadi)
  @Column({ type: 'int', nullable: true })
  followersCount: number | null;

  @Column({ type: 'int', nullable: true })
  mediaCount: number | null;

  // null = noma'lum (masalan .env dan ko'chirilgan eski token)
  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenRefreshedAt: Date | null;

  // 'active' | 'error' | 'disconnected' — error bo'lsa qayta ulash kerak
  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  connectedAt: Date;
}
