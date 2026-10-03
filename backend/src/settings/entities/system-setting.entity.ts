import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Butun tizim uchun umumiy sozlamalar (kalit → qiymat).
 *
 * Tezlik va limitlar shu yerda — ular foydalanuvchiga emas, adminga tegishli
 * va keyinchalik admin panelidan boshqariladi. Kalit-qiymat ko'rinishi yangi
 * sozlama qo'shishda migratsiya talab qilmaydi.
 */
@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'simple-json' })
  value: any;

  @UpdateDateColumn()
  updatedAt: Date;
}
