# Backend Chuyen De Mobile - Huong dan setup

## Yeu cau
- Node.js 18 - 22, npm.
- MongoDB (local hoac Atlas) co connection string.
- Tai khoan Cloudinary, Stripe (secret + webhook secret), ZaloPay, MoMo; Google Maps API key; Firebase service account JSON; SMTP (vd: Gmail).
- Docker (neu muon chay bang container).

## Cai dat nhanh
1) Clone repo va vao thu muc `Backend-Chuyen-De-Mobile`.
2) Tao file moi truong:  
   - macOS/Linux: `cp .env.example .env`  
   - PowerShell: `copy .env.example .env`
3) Cap nhat cac bien trong `.env` (xem danh sach ben duoi).  
4) Cai deps: `npm ci` (hoac `npm install` neu thay doi deps).  
5) Chay dev: `npm run dev` (hoac `npm start`). Mac dinh server nghe tai `http://localhost:3000`, Swagger tai `http://localhost:3000/api-docs`.

## Bien moi truong can co
- Core:  
  - `PORT` (mac dinh 3000)  
  - `MONGO_URI` (bat buoc)  
  - `JWT_SECRET`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Stripe: `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET`, `BASE_URL` (URL co /stripe-success.html va /stripe-cancel.html)
- MoMo: `MOMO_PARTNER_CODE`, `MOMO_ACCESS_KEY`, `MOMO_SECRET_KEY`, `MOMO_CREATE_ENDPOINT`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL`
- ZaloPay: `ZP_APP_ID`, `ZP_KEY1`, `ZP_KEY2`, `ZP_API_BASE` (mac dinh sandbox), `ZP_REDIRECT_URL`, `ZP_CALLBACK_URL`
- Google Maps: `GOOGLE_MAPS_API_KEY`
- Mail SMTP: `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM_NAME` (tuy chon), `MAIL_FROM_EMAIL` (tuy chon)
- Firebase: `FIREBASE_SERVICE_ACCOUNT` (chuoi JSON mot dong tu file service-account)

Luu y: Tham so thanh toan (MoMo, ZaloPay, Stripe) can duong dan callback/IPN truy cap duoc tu internet khi test (co the dung ngrok).

## Scripts huu ich
- `npm run dev` / `npm start`: khoi dong server.
- `npm run lint`: kiem tra ESLint.
- `npm run typecheck`: kiem tra kieu TypeScript.
- `npm test` hoac `npm run test:ci`: chay Jest.
- `npm run build`: bien dich TS (khong tu dong chay server).

## Chay bang Docker
```sh
docker build -t backend-mobile .
docker run --env-file .env -p 3000:3000 backend-mobile
```
Container dung `NODE_ENV=production` va chay `npm start`. Dam bao `.env` du cac key truoc khi run.

## Kiem tra nhanh
- Sau khi chay, truy cap `http://localhost:3000/api-docs` de xem Swagger.  
- API goc `/` tra ve string "Server running...".  
- Neu thieu `MONGO_URI` server se dung ngay khi start.
