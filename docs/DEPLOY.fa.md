# راه‌اندازی سرور و استقرار (برای جواد)

زمان تقریبی: ۴۵ تا ۶۰ دقیقه، یک بار. هر جا گیر کردی، از صفحه عکس بگیر و در همان رشته بفرست.
**هیچ رمز یا توکنی را در چت نفرست.** رمزها فقط در Coolify و گاوصندوق رمز (Bitwarden) می‌روند.

```
 ۱ Hetzner: سرور با Coolify ──► ۲ دامنه در Cloudflare ──► ۳ Coolify: اتصال GitHub
        ──► ۴ پایگاه داده + پشتیبان ──► ۵ اپ ──► ۶ ساخت حساب ادمین ──► ۷ ربات تلگرام ──► ۸ آزمایش
```

> **پیشنهاد مدیرعامل:** در شروع، اپ و n8n و NocoDB همه روی **یک سرور** با Coolify بروند (ارزان‌تر و کار کمتر برای تو). وقتی عددها نشان دادند لازم است، سرور دوم با چند کلیک در Coolify اضافه می‌شود (سند ۱۵، بخش ۸).

---

## ۱. ساخت سرور در Hetzner (با Coolify آماده)

1. در [console.hetzner.cloud](https://console.hetzner.cloud) حساب بساز (یا وارد شو) و یک Project به نام `genesis` بساز.
2. **Add Server** را بزن:
   - Location: **Nuremberg** یا **Falkenstein** (آلمان)
   - Image: زبانه **Apps** ← **Coolify**
   - Type: Shared vCPU، حدود **۴ هسته و ۸ گیگ** (مثلاً CPX31؛ حدود ۱۵ تا ۲۰ یورو در ماه)
   - Backups: روشن (۲۰٪ قیمت سرور؛ پشتیبان کل دیسک)
   - Name: `genesis-1`
3. **Create & Buy** را بزن و **آدرس IP** سرور را یادداشت کن (این را می‌توانی در رشته بفرستی).
4. در بخش **Firewalls** یک فایروال بساز با این ورودی‌ها و به سرور وصلش کن: پورت‌های `22`، `80`، `443` و `8000`.

## ۲. دامنه در Cloudflare

1. در [dash.cloudflare.com](https://dash.cloudflare.com) دامنه را اضافه کن (اگر هنوز نیست) و Nameserverهای Cloudflare را نزد ثبت‌کننده دامنه بگذار.
2. در **DNS** دو رکورد `A` بساز که به IP سرور اشاره کنند:
   - `app` ← IP سرور (مثلاً `app.legendpartner.com`؛ سایت فعلی دست نمی‌خورد)
   - `coolify` ← IP سرور
   فعلاً گزینه Proxy را **خاکستری (DNS only)** بگذار تا گواهی SSL ساخته شود؛ بعداً نارنجی‌اش می‌کنیم.

## ۳. ورود به Coolify و اتصال GitHub

1. در مرورگر برو به `http://IP-سرور:8000` و حساب ادمین Coolify را بساز (ایمیل خودت، رمز قوی در Bitwarden).
2. **Settings** ← Instance Domain را بگذار `https://coolify.دامنه` و ذخیره کن. از این به بعد از همین آدرس وارد شو و پورت ۸۰۰۰ را از فایروال Hetzner حذف کن.
3. **Sources** ← **+ Add** ← **GitHub App** ← مراحل را برو و فقط مخزن `genesis-platform` را به آن دسترسی بده.

## ۴. پایگاه داده و پشتیبان خودکار

1. در Hetzner Console ← **Object Storage** یک Bucket به نام `genesis-backups` بساز و یک کلید S3 (Access Key و Secret) بگیر.
2. در Coolify: **Settings** ← **S3 Storages** ← کلید را اضافه کن.
3. **Projects** ← `genesis` ← **+ New** ← **Database** ← **PostgreSQL 16**. نامش را `genesis-db` بگذار و Start را بزن.
4. در صفحه همان پایگاه داده ← **Backups** ← زمان‌بندی **روزانه** با مقصد S3 بالا.
5. از همان صفحه **Postgres URL (internal)** را کپی کن؛ در قدم بعد لازم است.

## ۵. اپ

1. **+ New** ← **Private Repository (with GitHub App)** ← مخزن `genesis-platform`، شاخه `main`.
2. Build Pack: **Docker Compose** (فایل `docker-compose.yml`).
3. در **Environment Variables** این‌ها را بگذار (توضیح هر کدام در فایل `.env.example` است):

   | نام | مقدار |
   |---|---|
   | `DATABASE_URL` | آدرس قدم ۴.۵ |
   | `APP_URL` و `BETTER_AUTH_URL` | `https://app.دامنه` |
   | `BETTER_AUTH_SECRET` | یک رشته تصادفی طولانی (دکمه Generate در Coolify یا یک رمز ۴۰ حرفی از Bitwarden) |
   | `TELEGRAM_WEBHOOK_SECRET` | یک رشته تصادفی دیگر |
   | `SITE_NAME` | نام شرکت |

4. برای سرویس **app** دامنه را بگذار `https://app.دامنه` (پورت ۳۰۰۰). سرویس **worker** دامنه نمی‌خواهد.
5. **Deploy** را بزن. وقتی تمام شد، `https://app.دامنه/api/health` باید `{"ok":true}` نشان دهد.

## ۶. ساخت حساب ادمین تو

در Coolify ← اپ ← **Terminal** ← کانتینر `app` را انتخاب کن و این را بزن (ایمیل و رمز خودت):

```
ADMIN_EMAIL=ایمیل-تو ADMIN_PASSWORD='رمز-حداقل-۱۲-حرف' ADMIN_NAME=Javad npm run seed
```

بعد در `https://app.دامنه/cockpit` وارد شو.

## ۷. ربات تلگرام برای تأییدها

1. در تلگرام به **@BotFather** پیام بده ← `/newbot` ← یک نام بده. **توکن** را بگیر.
2. به ربات تازه یک پیام بده (مثلاً «سلام»).
3. در مرورگر برو به `https://api.telegram.org/bot<توکن>/getUpdates` و دو عدد را پیدا کن: `chat.id` و `from.id` (معمولاً یکی‌اند).
4. در Coolify این‌ها را به Environment Variables اضافه کن و دوباره Deploy کن:
   `TELEGRAM_BOT_TOKEN` = توکن، `TELEGRAM_ADMIN_CHAT_ID` = chat.id، `TELEGRAM_ADMIN_USER_IDS` = from.id
5. این آدرس را یک بار در مرورگر باز کن (به‌جای عبارت‌های فارسی مقدار خودت را بگذار):
   `https://api.telegram.org/bot<توکن>/setWebhook?url=https://app.دامنه/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`
   باید `"ok":true` ببینی.

## ۸. آزمایش کامل

در Terminal کانتینر `app` این را بزن:

```
npm run smoke
```

چند ثانیه بعد باید در تلگرامت پیام «درخواست تأیید» با دو دکمه بیاید. ✅ را بزن و آدرسی که دستور چاپ کرد را باز کن؛ صفحه آزمایشی باید منتشر شده باشد. بعد در رشته بگو «سرور آماده است» (فقط همین؛ هیچ کلید یا رمزی نفرست).

---

### بعد از این (کار من، نه تو)

- نصب n8n و NocoDB روی همین Coolify (هر کدام یک کلیک) و وصل کردن NocoDB به همین پایگاه داده.
- روشن کردن Proxy نارنجی Cloudflare و قانون‌های فایروال.
- اولین جریان n8n که ایجنت محتوا را به `/api/v1/drafts` وصل می‌کند.
