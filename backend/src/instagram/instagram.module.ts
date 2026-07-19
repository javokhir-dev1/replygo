import { Module } from '@nestjs/common';
import { InstagramService } from './instagram.service';
import { InstagramController } from './instagram.controller';
import { IgCredsProvider } from '../config/ig-creds.provider';

@Module({
  controllers: [InstagramController],
  providers: [InstagramService, IgCredsProvider],
  exports: [InstagramService, IgCredsProvider],
})
export class InstagramModule {}
