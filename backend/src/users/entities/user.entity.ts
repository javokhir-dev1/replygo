import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/** ReplyGo foydalanuvchisi (panelga kirish). Instagram akkaunti alohida jadvalda. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // Har doim kichik harfda saqlanadi — "Ali" va "ali" bitta odam
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  username: string;

  // scrypt$N$r$p$salt$hash — parametrlar bilan birga, keyin kuchaytirish oson bo'lsin
  @Column({ type: 'varchar' })
  passwordHash: string;

  // Sessiya versiyasi: parol o'zgarganda oshadi va eski tokenlar (boshqa
  // qurilmalardagi) bekor bo'ladi. JWT ichida `v` sifatida yuradi.
  @Column({ type: 'int', default: 0 })
  tokenVersion: number;

  // Panelda hozir tanlangan Instagram akkaunt (bir nechtasi bo'lishi mumkin).
  // Qoidalar, statistika va postlar shu akkaunt bo'yicha ko'rsatiladi.
  @Column({ type: 'int', nullable: true })
  activeIgAccountId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
