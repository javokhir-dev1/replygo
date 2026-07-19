# ReplyGo

Instagram komment va DM avtomatizatsiyasi — **bitta foydalanuvchi** uchun soddalashtirilgan versiya.
Login yo'q; barcha token va sozlamalar `.env` fayldan olinadi.

`javobgo` loyihasidagi avtomatizatsiya logikasi asos qilib olingan, lekin:
- ko'p foydalanuvchi / telegram / JWT login **olib tashlangan**
- AI agent qismi **olib tashlangan** (faqat shablon javoblar)
- ma'lumotlar bazasi **PostgreSQL**

## Tuzilma

```
replygo/
├── backend/          NestJS + TypeORM (PostgreSQL)
│   └── src/
│       ├── config/         .env dan Instagram creds
│       ├── instagram/      Graph API chaqiruvlari (reply, DM, tugmalar, postlar)
│       ├── automations/    qoidalar CRUD
│       ├── logs/           yuborilgan javoblar tarixi
│       ├── rate-limit/     foydalanuvchi bo'yicha cheklov
│       └── webhook/        Instagram webhook + komment "engine"
└── frontend/         Next.js panel (login yo'q)
    ├── app/          ro'yxat + forma + loglar sahifasi
    └── components/   AutomationForm
```

## Ishlash mantig'i

Instagram postga izoh kelganda → webhook `POST /api/webhook` → faol qoidalar tekshiriladi:
1. Post ko'lami (`all` yoki tanlangan postlar) mos kelsa,
2. kalit so'z sharti bajarilsa (`any` bo'lsa doim),
3. foydalanuvchi limiti tugamagan bo'lsa,
4. tasodifiy 5–10 soniya kutib, izohga shablon javob yoziladi va/yoki DM yuboriladi.

`{name}` → foydalanuvchi nomi, `{comment}` → izoh matni bilan almashtiriladi.
Bir izohga faqat bitta qoida javob beradi.

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

| Metod | Yo'l | Vazifa |
|------|------|--------|
| GET | `/api/automations` | barcha qoidalar |
| POST | `/api/automations` | yangi qoida |
| PATCH | `/api/automations/:id` | tahrirlash |
| PATCH | `/api/automations/:id/toggle` | yoqish/o'chirish |
| DELETE | `/api/automations/:id` | o'chirish |
| GET | `/api/instagram/posts` | postlar ro'yxati |
| GET | `/api/instagram/account` | ulangan akkaunt holati |
| GET | `/api/logs` | loglar |
| GET/POST | `/api/webhook` | Meta webhook |

## Eslatma
- `synchronize: true` kichik loyiha uchun qulay; production da TypeORM migration ishlatgan ma'qul.
- Webhook Metaga darhol `200` qaytaradi, ishlov fon rejimida bajariladi.
