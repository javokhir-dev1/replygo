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

  async sendDM(creds: IgCredentials, recipientId: string, text: string) {
    const res = await http.post(`${BASE_URL}/${creds.accountId}/messages`, {
      recipient: { id: recipientId },
      message: { text },
      access_token: creds.token,
    });
    return res.data;
  }

  async sendDMButtons(
    creds: IgCredentials,
    recipientId: string,
    text: string,
    buttons: { title: string; url: string }[],
  ) {
    const res = await http.post(`${BASE_URL}/${creds.accountId}/messages`, {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text,
            buttons: buttons.slice(0, 3).map((b) => ({
              type: 'web_url',
              url: b.url,
              title: b.title,
            })),
          },
        },
      },
      access_token: creds.token,
    });
    return res.data;
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
  private buttonTemplate(text: string, buttons: { title: string; payload: string }[]) {
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
    const res = await http.post(`${BASE_URL}/${creds.accountId}/messages`, {
      recipient: { comment_id: commentId },
      message: this.buttonTemplate(text, buttons),
      access_token: creds.token,
    });
    return res.data;
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
    const res = await http.post(`${BASE_URL}/${creds.accountId}/messages`, {
      recipient: { id: recipientId },
      message: this.buttonTemplate(text, buttons),
      access_token: creds.token,
    });
    return res.data;
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
