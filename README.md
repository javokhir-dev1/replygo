# ReplyGo

Instagram komment va DM avtomatizatsiyasi — **bitta foydalanuvchi** uchun soddalashtirilgan versiya.
Barcha Instagram token va sozlamalari `.env` fayldan olinadi; panelga kirish
bitta login/parol bilan himoyalangan (u ham `.env` da).

`javobgo` loyihasidagi avtomatizatsiya logikasi asos qilib olingan, lekin:
- ko'p foydalanuvchi / telegram / JWT login **olib tashlangan**
- AI agent qismi **olib tashlangan** (faqat shablon javoblar)
- ma'lumotlar bazasi **PostgreSQL**

## Tuzilma

```
replygo/
├── backend/          NestJS + TypeORM (PostgreSQL)
│   └── src/
│       ├── auth/           login, JWT, global guard
│       ├── config/         .env dan Instagram creds
│       ├── instagram/      Graph API chaqiruvlari (reply, DM, tugmalar, postlar)
│       ├── automations/    qoidalar CRUD
│       ├── logs/           yuborilgan javoblar tarixi
│       ├── rate-limit/     foydalanuvchi bo'yicha cheklov
│       └── webhook/        Instagram webhook + komment "engine"
└── frontend/         Next.js panel
    ├── app/          login + ro'yxat + forma + loglar sahifasi
    ├── components/   Shell (kirish darvozasi + header), AutomationForm
    └── lib/          api.ts (Authorization header), auth.ts (token)
```

## Kirish (login)

Panelning **barcha** endpointlari default himoyalangan. Faqat ikkitasi ochiq:
`POST /api/auth/login` va `/api/webhook` (uni Meta chaqiradi, u `x-hub-signature-256`
imzosi bilan himoyalangan).

Oqim: login/parol → backend tekshiradi → JWT qaytaradi → token brauzer
`localStorage` da saqlanadi → har bir so'rovga `Authorization: Bearer <token>`
qo'shiladi. Token muddati tugasa yoki yaroqsiz bo'lsa, frontend avtomatik
login sahifasiga qaytaradi.

Qo'shimcha himoya: bitta IP dan 5 marta xato parol kiritilsa, 15 daqiqaga
bloklanadi.

`.env` da:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=kuchli-parol
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=7d
```

Uchalasi to'ldirilmasa backend **ishga tushmaydi** — bu himoyasiz deploy
qilib qo'yishning oldini oladi. `JWT_SECRET` o'zgartirilsa barcha mavjud
tokenlar bekor bo'ladi (majburiy qayta kirish).

## Ishlash mantig'i

Instagram postga izoh kelganda → webhook `POST /api/webhook` → faol qoidalar tekshiriladi:
1. Post ko'lami (`all` yoki tanlangan postlar) mos kelsa,
2. kalit so'z sharti bajarilsa (`any` bo'lsa doim),
3. foydalanuvchi limiti tugamagan bo'lsa,
4. tasodifiy 5–10 soniya kutib, izohga shablon javob yoziladi va/yoki DM yuboriladi.

`{name}` → foydalanuvchi nomi, `{comment}` → izoh matni bilan almashtiriladi.
Bir izohga faqat bitta qoida javob beradi.

### DM qanday yuboriladi

Kommentga javoban DM **private reply** (`recipient.comment_id`) orqali ketadi —
u 24 soatlik xabar oynasini talab qilmaydi. Meta cheklovlari:

- bitta kommentga faqat **bitta** xabar
- komment yozilganidan keyin **7 kun** ichida
- Live uchun faqat efir davomida

Oddiy DM (`recipient.id`) faqat oyna ochiq bo'lganda ishlaydi va shuning uchun
faqat foydalanuvchi tugmani bosgandan keyin (obuna tekshiruvidan so'ng)
ishlatiladi. Aralashtirilsa Meta `code 10 / subcode 2534022` qaytaradi.

## O'rnatish

### 1. Ma'lumotlar bazasi
PostgreSQL da `replygo` nomli baza yarating:
```sql
CREATE DATABASE replygo;
```
Jadvallar birinchi ishga tushirishda avtomatik yaratiladi (`synchronize: true`).

### 2. Backend
```bash
cd backend
cp .env.example .env      # va qiymatlarni to'ldiring
npm install
npm run start:dev         # http://localhost:4000
```

`.env` da to'ldiriladigan asosiy qiymatlar:
- `IG_ACCESS_TOKEN` — Instagram Graph API uzoq muddatli token
- `IG_ACCOUNT_ID` — Instagram Business Account ID
- `INSTAGRAM_APP_SECRET` — webhook imzosini tekshirish uchun (tavsiya etiladi)
- `WEBHOOK_VERIFY_TOKEN` — Meta panelida webhookni ulashda
- `DATABASE_URL` — PostgreSQL ulanish satri

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL ni tekshiring
npm install
npm run dev                  # http://localhost:3000
```

### 4. Webhook ulash (Meta panelida)
- Callback URL: `https://SIZNING_DOMEN/api/webhook`
- Verify token: `.env` dagi `WEBHOOK_VERIFY_TOKEN` bilan bir xil
- `comments` maydoniga obuna bo'ling.

Lokalda test uchun `ngrok http 4000` orqali public URL oching.

## API (backend)

🔒 = `Authorization: Bearer <token>` talab qiladi.

| Metod | Yo'l | Vazifa |
|------|------|--------|
| POST | `/api/auth/login` | login/parol → token |
| GET | 🔒 `/api/auth/me` | token hali amal qilyaptimi |
| GET | 🔒 `/api/automations` | barcha qoidalar |
| POST | 🔒 `/api/automations` | yangi qoida |
| PATCH | 🔒 `/api/automations/:id` | tahrirlash |
| PATCH | 🔒 `/api/automations/:id/toggle` | yoqish/o'chirish |
| DELETE | 🔒 `/api/automations/:id` | o'chirish |
| GET | 🔒 `/api/instagram/posts` | postlar ro'yxati |
| GET | 🔒 `/api/instagram/account` | ulangan akkaunt holati |
| GET | 🔒 `/api/logs` | loglar |
| GET/POST | `/api/webhook` | Meta webhook (imzo bilan himoyalangan) |

## Eslatma
- `synchronize: true` kichik loyiha uchun qulay; production da TypeORM migration ishlatgan ma'qul.
- Webhook Metaga darhol `200` qaytaradi, ishlov fon rejimida bajariladi.
- Guard **default himoya** tamoyilida ishlaydi: yangi controller qo'shsangiz u
  avtomatik himoyalanadi. Ochiq qilish uchun `@Public()` ni ataylab qo'yish kerak.
- Token `localStorage` da turadi. Production da panelni HTTPS orqali oching —
  aks holda token tarmoqda ochiq ketadi.
