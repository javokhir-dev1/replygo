import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { InstagramController } from './instagram.controller';
import { InstagramMediaService } from './instagram-media.service';

@Module({
  controllers: [InstagramController],
  providers: [InstagramService, InstagramMediaService],
  exports: [InstagramService, InstagramMediaService],
})
export class InstagramModule {}
