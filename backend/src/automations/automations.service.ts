import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Automation } from './entities/automation.entity';
import { CreateAutomationDto } from './dto/create-automation.dto';

@Injectable()
export class AutomationsService {
  constructor(
    @InjectRepository(Automation)
    private repo: Repository<Automation>,
  ) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findActive() {
    return this.repo.find({ where: { isActive: true } });
  }

  async findOne(id: number) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Avtomatizatsiya topilmadi');
    return a;
  }

  create(dto: CreateAutomationDto) {
    const a = this.repo.create(dto);
    return this.repo.save(a);
  }

  async update(id: number, dto: Partial<CreateAutomationDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async toggle(id: number) {
    const a = await this.findOne(id);
    a.isActive = !a.isActive;
    return this.repo.save(a);
  }

  async remove(id: number) {
    const a = await this.findOne(id);
    return this.repo.remove(a);
  }
}
