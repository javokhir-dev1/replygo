import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IgAccount } from './entities/ig-account.entity';
import { IgAccountSnapshot } from './entities/ig-account-snapshot.entity';
import { IgAccountsService } from './ig-accounts.service';
import { IgOAuthService } from './ig-oauth.service';

/** Global: webhook va instagram controller akkaunt/tokenni shu yerdan oladi */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IgAccount, IgAccountSnapshot])],
  providers: [IgAccountsService, IgOAuthService],
  exports: [IgAccountsService, IgOAuthService],
})
export class IgAccountsModule {}
