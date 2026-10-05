import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { hashPassword } from '../common/password';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  static normalize(username: string): string {
    return String(username || '').trim().toLowerCase();
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username: UsersService.normalize(username) } });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  count() {
    return this.repo.count();
  }

  async create(username: string, password: string): Promise<User> {
    const name = UsersService.normalize(username);
    if (await this.findByUsername(name)) {
      throw new ConflictException('Bu login band. Boshqasini tanlang.');
    }
    const user = this.repo.create({ username: name, passwordHash: await hashPassword(password) });
    try {
      return await this.repo.save(user);
    } catch (e: any) {
      // Ikki so'rov bir vaqtda kelsa — unique indeks ushlaydi
      if (e?.code === '23505') throw new ConflictException('Bu login band. Boshqasini tanlang.');
      throw e;
    }
  }

  async changeUsername(id: number, username: string): Promise<User> {
    const name = UsersService.normalize(username);
    const taken = await this.findByUsername(name);
    if (taken && taken.id !== id) throw new ConflictException('Bu login band. Boshqasini tanlang.');
    try {
      await this.repo.update({ id }, { username: name });
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('Bu login band. Boshqasini tanlang.');
      throw e;
    }
    return (await this.findById(id))!;
  }

  /** Parolni almashtiradi va sessiya versiyasini oshiradi (boshqa qurilmalar chiqadi) */
  async changePassword(id: number, password: string): Promise<User> {
    await this.repo.update({ id }, { passwordHash: await hashPassword(password) });
    await this.repo.increment({ id }, 'tokenVersion', 1);
    return (await this.findById(id))!;
  }

  async setActiveIgAccount(id: number, igAccountId: number | null) {
    await this.repo.update({ id }, { activeIgAccountId: igAccountId });
  }

  async touchLogin(id: number) {
    await this.repo.update({ id }, { lastLoginAt: new Date() });
  }
}
