<p align="center">
  <strong>DAI HOC QUOC GIA THANH PHO HO CHI MINH</strong><br/>
  <strong>TRUONG DAI HOC CONG NGHE THONG TIN</strong>
</p>

<p align="center">
  <strong>BAO CAO CHUYEN DE MOBILE AND PERVASIVE COMPUTING</strong><br/>
  <strong>DE TAI</strong><br/>
  <span style="color:#c00000"><strong>UNG DUNG CHAM CONG BANG NHAN DIEN KHUON MAT</strong></span>
</p>

<p align="center">
  <em>(Logo UIT)</em>
</p>

**Giang vien huong dan:** Nguyen Tan Toan  
**Lop:** SE405.Q11  
**Mon hoc:** Chuyen de Mobile and Pervasive Computing  
**Sinh vien thuc hien:**  
- Tran Ngoc Phu - 22521107  
- Le Quang Phuc - 22521118  
- Truong Dac Dien - 22520248  
- Nguyen Cong Thanh - 22521351  

<p align="center"><strong>TP. Ho Chi Minh, 2025</strong></p>

---

# Backend Chuyen De Mobile
API backend Express + MongoDB, tich hop thanh toan (Stripe/MoMo/ZaloPay), upload (Cloudinary), maps, email.

## Quickstart
1. Yeu cau: Node.js 18 - 22, npm; MongoDB; (tuy chon) Docker.  
2. Clone repo va vao thu muc: `Backend-Chuyen-De-Mobile`
3. Tao file moi truong:  
   - macOS/Linux: `cp .env.example .env`  
   - PowerShell: `copy .env.example .env`
4. Dien `.env` theo mau duoi.  
5. Cai deps: `npm ci` (hoac `npm install`).  
6. Chay server: `npm run dev` (hoac `npm start`).  
   - API: `http://localhost:3000/`  
   - Swagger: `http://localhost:3000/api-docs`

> Tip: Neu test webhook (Stripe/MoMo/ZaloPay) can expose callback/IPN ra internet (vd: ngrok).

## .env mau (day du cac nhom key)
```env
# Core
PORT=3000
MONGO_URI=mongodb+srv://...
JWT_SECRET=change-me

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Stripe
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
BASE_URL=http://localhost:3000   # dung cho stripe-success.html / stripe-cancel.html

# MoMo
MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_CREATE_ENDPOINT=
MOMO_REDIRECT_URL=
MOMO_IPN_URL=

# ZaloPay
ZP_APP_ID=
ZP_KEY1=
ZP_KEY2=
ZP_API_BASE=https://sb-openapi.zalopay.vn
ZP_REDIRECT_URL=
ZP_CALLBACK_URL=

# Google Maps
GOOGLE_MAPS_API_KEY=

# SMTP
MAIL_USER=
MAIL_PASS=
MAIL_FROM_NAME=MyApp
MAIL_FROM_EMAIL=

# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # json mot dong
```

## Scripts huu ich
- `npm run dev` / `npm start`: khoi dong server.
- `npm run lint`: kiem tra ESLint.
- `npm run typecheck`: kiem tra kieu TypeScript.
- `npm test` / `npm run test:ci`: chay Jest.
- `npm run build`: bien dich TS (khong tu dong chay server).

## Chay bang Docker
```sh
docker build -t backend-mobile .
docker run --env-file .env -p 3000:3000 backend-mobile
```
Container dung `NODE_ENV=production` va chay `npm start`. Dam bao `.env` du key truoc khi run.

## Smoke test nhanh
- GET `http://localhost:3000/` nhan string "Server running...".
- Mo `http://localhost:3000/api-docs` xem Swagger.  
- Neu thieu `MONGO_URI` server se dung ngay khi start (check log).
