import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Paneldan o'zgartiriladigan ish sozlamalari — har foydalanuvchiga bitta qator.
 *
 * id = foydalanuvchi ID'si. Faqat panelda o'zgartirilgan qiymatlar saqlanadi;
 * qolganlari .env dan (umumiy standart) olinadi. Qator o'chirilsa — .env/standart.
 */
@Entity('app_settings')
export class AppSettings {
  // = userId
  @PrimaryColumn({ type: 'int' })
  id: number;

  @Column({ type: 'simple-json', default: '{}' })
  data: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;
}
