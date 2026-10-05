import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { IgRateLimitError, isRateLimitError, getRetryAfterMs, getUsagePercent } from './ig-errors';
import { setThrottle } from './ig-throttle';

const BASE_URL = 'https://graph.instagram.com/v21.0';

// Ish foizi shu chegaradan oshsa, limitdan OLDIN navbatni sekinlashtiramiz
const USAGE_PAUSE_THRESHOLD = Number(process.env.IG_USAGE_PAUSE_THRESHOLD ?? 90);
const USAGE_PAUSE_MS = Number(process.env.IG_USAGE_PAUSE_MS ?? 60_000);

// Alohida axios instansi:
//  - muvaffaqiyatli javobda ish foizini tekshiradi (proaktiv sekinlashish)
//  - rate-limit (429/kod) javoblarini IgRateLimitError'ga aylantiradi
const http = axios.create();
http.interceptors.response.use(
  (res) => {
    const usage = getUsagePercent(res.headers);
    if (usage >= USAGE_PAUSE_THRESHOLD) {
      setThrottle(USAGE_PAUSE_MS);
    }
    return res;
  },
  (error) => {
    if (isRateLimitError(error)) {
      return Promise.reject(new IgRateLimitError(getRetryAfterMs(error), error));
    }
    return Promise.reject(error);
  },
);

export interface IgCredentials {
  token: string;
  accountId: string;
}

@Injectable()
export class InstagramService {
  private readonly logger = new Logger(InstagramService.name);

  async replyToComment(creds: IgCredentials, commentId: string, text: string) {
    const res = await http.post(`${BASE_URL}/${commentId}/replies`, {
      message: text,
      access_token: creds.token,
    });
    return res.data;
  }

  /** Barcha xabar yuborish yo'llari uchun yagona nuqta */
  private async postMessage(creds: IgCredentials, recipient: object, message: object) {
    const res = await http.post(`${BASE_URL}/${creds.accountId}/messages`, {
      recipient,
      message,
      access_token: creds.token,
    });
    return res.data;
  }

  /** URL tugmali shablon (bosilganda saytga o'tadi) */
  private urlButtonTemplate(text: string, buttons: { title: string; url: string }[]) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text.substring(0, 640),
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'web_url',
            url: b.url,
            title: b.title.substring(0, 20),
          })),
        },
      },
    };
  }

  /**
   * Oddiy DM (recipient.id).
   * DIQQAT: faqat 24 soatlik xabar oynasi OCHIQ bo'lganda ishlaydi — ya'ni
   * foydalanuvchi oxirgi 24 soat ichida bizga xabar yozgan bo'lishi kerak.
   * Kommentga javoban yuborish uchun sendPrivateReply() ni ishlating,
   * aks holda Meta `code 10 / subcode 2534022` qaytaradi.
   */
  async sendDM(creds: IgCredentials, recipientId: string, text: string) {
    return this.postMessage(creds, { id: recipientId }, { text });
  }

  async sendDMButtons(
    creds: IgCredentials,
    recipientId: string,
    text: string,
    buttons: { title: string; url: string }[],
  ) {
    return this.postMessage(creds, { id: recipientId }, this.urlButtonTemplate(text, buttons));
  }

  /**
   * PRIVATE REPLY — kommentga javoban shaxsiy xabar (recipient.comment_id).
   * 24 soatlik oyna TALAB QILINMAYDI. Cheklovlar (Meta hujjati bo'yicha):
   *   - bitta kommentga faqat BITTA xabar
   *   - komment yozilganidan keyin 7 kun ichida
   *   - Live uchun faqat efir davomida
   * Foydalanuvchi obuna bo'lsa "Inbox"ga, bo'lmasa "Requests"ga tushadi.
   */
  async sendPrivateReply(creds: IgCredentials, commentId: string, text: string) {
    return this.postMessage(creds, { comment_id: commentId }, { text });
  }

  /** Private reply — URL tugmalari bilan */
  async sendPrivateReplyButtons(
    creds: IgCredentials,
    commentId: string,
    text: string,
    buttons: { title: string; url: string }[],
  ) {
    return this.postMessage(
      creds,
      { comment_id: commentId },
      this.urlButtonTemplate(text, buttons),
    );
  }

  /**
   * Xabar yozgan foydalanuvchi profili.
   * is_user_follow_business — foydalanuvchi bizning akkauntga obuna bo'lganmi.
   * DIQQAT: bu maydon faqat foydalanuvchi botga kamida bitta xabar yuborgandan
   * keyin (ochiq suhbat mavjud bo'lganda) qaytadi.
   */
  async getUserProfile(creds: IgCredentials, igsid: string) {
    const res = await http.get(`${BASE_URL}/${igsid}`, {
      params: {
        fields: 'name,username,is_user_follow_business',
        access_token: creds.token,
      },
    });
    return res.data as {
      name?: string;
      username?: string;
      is_user_follow_business?: boolean;
    };
  }

  /** Foydalanuvchi bizga obuna bo'lganini tekshiradi */
  async isUserFollowing(creds: IgCredentials, igsid: string): Promise<boolean> {
    const profile = await this.getUserProfile(creds, igsid);
    return profile.is_user_follow_business === true;
  }

  /**
   * Button template — tugmalar xabar bubble'iga QO'SHILIB chiqadi (quick reply kabi
   * pastda emas). Bosilganda 'postback' event webhook orqali qaytadi.
   */
  private postbackTemplate(text: string, buttons: { title: string; payload: string }[]) {
    return {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'button',
          text: text.substring(0, 640),
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'postback',
            title: b.title.substring(0, 20),
            payload: b.payload,
          })),
        },
      },
    };
  }

  /**
   * Kommentga PRIVATE REPLY — xabarga qo'shilgan (postback) tugmalar bilan.
   * Birinchi kontakt: messaging oyna shart emas, lekin har bir komment uchun
   * faqat BIR marta va 7 kun ichida yuborish mumkin.
   */
  async sendCommentButtons(
    creds: IgCredentials,
    commentId: string,
    text: string,
    buttons: { title: string; payload: string }[],
  ) {
    return this.postMessage(
      creds,
      { comment_id: commentId },
      this.postbackTemplate(text, buttons),
    );
  }

  /**
   * Mavjud suhbatga — xabarga qo'shilgan (postback) tugmalar bilan (recipient.id).
   * Faqat 24 soatlik messaging oyna ochiq bo'lganda ishlaydi.
   */
  async sendPostbackButtons(
    creds: IgCredentials,
    recipientId: string,
    text: string,
    buttons: { title: string; payload: string }[],
  ) {
    return this.postMessage(creds, { id: recipientId }, this.postbackTemplate(text, buttons));
  }

  async getAccountInfo(creds: IgCredentials) {
    const res = await http.get(`${BASE_URL}/${creds.accountId}`, {
      params: {
        fields: 'id,username,profile_picture_url,followers_count,media_count',
        access_token: creds.token,
      },
    });
    return res.data;
  }

  async getRecentPosts(creds: IgCredentials, limit = 20) {
    const res = await http.get(`${BASE_URL}/${creds.accountId}/media`, {
      params: {
        fields:
          'id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit,
        access_token: creds.token,
      },
    });
    return res.data.data as any[];
  }
}

/**
 * Rate-limit interceptor'lari bilan umumiy axios klienti — boshqa Instagram
 * servislari (masalan statistika) ham 429 himoyasidan foydalanishi uchun.
 */
export { http as igHttp, BASE_URL as IG_BASE_URL };
