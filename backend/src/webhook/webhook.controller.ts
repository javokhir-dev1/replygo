import { Controller, Get, Post, Query, Req, Res, HttpCode, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { WebhookService } from './webhook.service';

@Controller('api/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly webhookService: WebhookService,
  ) {}

  // Meta panelida webhookni tasdiqlash
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifyToken = this.config.get('WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook tasdiqlandi');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }

  @Post()
  @HttpCode(200)
  receive(@Req() req: Request & { rawBody?: Buffer; body: any }, @Res() res: Response) {
    const body = req.body;

    // Imzo tekshiruvi (agar APP_SECRET berilgan bo'lsa)
    const appSecret = this.config.get<string>('INSTAGRAM_APP_SECRET');
    if (appSecret) {
      const sigHeader = req.headers['x-hub-signature-256'] as string | undefined;
      if (!sigHeader || !req.rawBody) {
        this.logger.warn('Webhook: imzo/rawBody yo\'q');
        return res.sendStatus(403);
      }
      const expected =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');
      const sigBuf = Buffer.from(sigHeader);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        this.logger.warn('Webhook: imzo mos kelmadi');
        return res.sendStatus(403);
      }
    }

    // Metaga darhol 200 qaytaramiz, ishlov navbat orqali keyin bajariladi
    res.sendStatus(200);

    const entries = Array.isArray(body?.entry) ? body.entry : [];
    this.logger.log(
      `📩 Webhook keldi: object=${body?.object ?? '?'}, entry soni=${entries.length}`,
    );
    if (!entries.length) {
      this.logger.warn(`Webhook: entry bo'sh. To'liq body: ${JSON.stringify(body)}`);
    }
    for (const entry of entries) {
      // Navbatga qo'shamiz — kommentlar va DM'lar alohida worker'larda ishlanadi
      this.webhookService.enqueueEntry(entry).catch((err) => {
        this.logger.error(`Entry navbatga qo'shishda xato: ${err.message}`);
      });
    }
  }
}
