import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entities/log.entity';

export interface CreateLogInput {
  type: string;
  action: string;
  message?: string;
  user?: string;
  userMessage?: string;
}

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(Log)
    private repo: Repository<Log>,
  ) {}

  create(input: CreateLogInput) {
    const log = this.repo.create(input);
    return this.repo.save(log);
  }

  findAll(limit = 100) {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  clear() {
    return this.repo.clear();
  }
}
