import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RateLimit } from './entities/rate-limit.entity';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [TypeOrmModule.forFeature([RateLimit])],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
