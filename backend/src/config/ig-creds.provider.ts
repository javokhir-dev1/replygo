import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IgCredentials } from '../instagram/instagram.service';

/**
 * Bitta foydalanuvchi rejimi: barcha token va akkaunt ID
 * .env fayldan olinadi (login/ko'p foydalanuvchi yo'q).
 */
@Injectable()
export class IgCredsProvider {
  constructor(private readonly config: ConfigService) {}

  get creds(): IgCredentials {
    return {
      token: this.config.get<string>('IG_ACCESS_TOKEN') || '',
      accountId: this.config.get<string>('IG_ACCOUNT_ID') || '',
    };
  }

  get accountId(): string {
    return this.config.get<string>('IG_ACCOUNT_ID') || '';
  }
}
