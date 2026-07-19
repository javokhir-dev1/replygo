import 'dotenv/config'; // .env ni barcha importlardan oldin yuklaymiz (worker options uchun)
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody webhook imzosini (x-hub-signature-256) tekshirish uchun kerak
    bodyParser: false,
  });

  // JSON body + rawBody ni saqlab qolamiz
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  const config = app.get(ConfigService);
  const origin = config.get<string>('FRONTEND_ORIGIN') || '*';
  app.enableCors({ origin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  const port = config.get<number>('PORT') || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ReplyGo backend ishga tushdi: http://localhost:${port}`);
}
bootstrap();
