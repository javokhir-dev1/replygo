import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Foydalanuvchiga ulangan Instagram professional akkaunti.
 *
 * Bitta foydalanuvchi — bitta akkaunt; bitta Instagram akkaunt — faqat bitta
 * foydalanuvchida (aks holda webhook kimga tegishli ekani noaniq bo'lardi).
 */
@Entity('ig_accounts')
export class IgAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
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

  // AES-256-GCM bilan shifrlangan uzoq muddatli token (common/secret-box)
  @Column({ type: 'text' })
  tokenEnc: string;

  // null = noma'lum (masalan .env dan ko'chirilgan eski token)
  @Column({ type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  tokenRefreshedAt: Date | null;

  // 'active' | 'error' — error bo'lsa foydalanuvchi qayta ulashi kerak
  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  connectedAt: Date;
}
