import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Automation } from './entities/automation.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';

/**
 * Har bir metod userId bilan ishlaydi — foydalanuvchi faqat o'z qoidalarini
 * ko'radi va o'zgartiradi. Boshqasining qoidasiga murojaat "topilmadi" (404)
 * qaytaradi, "ruxsat yo'q" (403) emas: ID'lar mavjudligini ham oshkor qilmaymiz.
 */
@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(Automation)
    private repo: Repository<Automation>,
  ) {}

  findAll(userId: number) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  findActive(userId: number) {
    return this.repo.find({ where: { userId, isActive: true } });
  }

  async findOne(id: number, userId: number) {
    const a = await this.repo.findOne({ where: { id, userId } });
    if (!a) throw new NotFoundException('Avtomatizatsiya topilmadi');
    return a;
  }

  create(userId: number, dto: CreateAutomationDto) {
    return this.repo.save(this.repo.create({ ...dto, userId }));
  }

  async update(id: number, userId: number, dto: CreateAutomationDto) {
    await this.findOne(id, userId);
    // userId DTO'da yo'q (ValidationPipe whitelist uni olib tashlaydi) — egani o'zgartirib bo'lmaydi
    await this.repo.update({ id, userId }, dto);
    return this.findOne(id, userId);
  }

  async toggle(id: number, userId: number) {
    const a = await this.findOne(id, userId);
    a.isActive = !a.isActive;
    return this.repo.save(a);
  }

  async remove(id: number, userId: number) {
    const a = await this.findOne(id, userId);
    return this.repo.remove(a);
  }
}
