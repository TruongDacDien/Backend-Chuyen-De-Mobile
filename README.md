<p align="center">
  <strong>ĐẠI HỌC QUỐC GIA THÀNH PHỐ HỒ CHÍ MINH</strong><br/>
  <strong>TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN</strong>
</p>

<p align="center">
  <strong>BÁO CÁO CHUYÊN ĐỀ MOBILE AND PERVASIVE COMPUTING</strong><br/>
  <strong>ĐỀ TÀI</strong><br/>
  <span style="color:#c00000"><strong>ỨNG DỤNG CHẤM CÔNG BẰNG NHẬN DIỆN KHUÔN MẶT</strong></span>
</p>

<p align="center">
  <img src="https://tse3.mm.bing.net/th/id/OIP.o4oXRVly8XAYrPIodBZZ0AHaI2?pid=Api&P=0&h=220" alt="UIT logo" width="200"/>
</p>

**Giảng viên hướng dẫn:** Nguyễn Tấn Toàn  
**Lớp:** SE405.Q11  
**Môn học:** Chuyên đề Mobile and Pervasive Computing  
**Sinh viên thực hiện:**  
- Trần Ngọc Phú - 22521107  
- Lê Quang Phúc - 22521118  
- Trương Đắc Điền - 22520248  
- Nguyễn Công Thành - 22521351  

<p align="center"><strong>TP. Hồ Chí Minh, 2025</strong></p>

---

# Backend Chuyên Đề Mobile
API backend Express + MongoDB, tích hợp thanh toán (Stripe/MoMo/ZaloPay), tải lên (Cloudinary), bản đồ, email.

## Quickstart
1. Yêu cầu: Node.js 18 - 22, npm; MongoDB; (tùy chọn) Docker.  
2. Clone repo và vào thư mục: `Backend-Chuyen-De-Mobile`
3. Tạo file môi trường:  
   - macOS/Linux: `cp .env.example .env`  
   - PowerShell: `copy .env.example .env`
4. Điền `.env` theo mẫu dưới.  
5. Cài deps: `npm ci` (hoặc `npm install`).  
6. Chạy server: `npm run dev` (hoặc `npm start`).  
   - API: `http://localhost:3000/`  
   - Swagger: `http://localhost:3000/api-docs`

> Tip: Nếu test webhook (Stripe/MoMo/ZaloPay) cần expose callback/IPN ra internet (vd: ngrok).

## .env mẫu (đầy đủ các nhóm key)
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
BASE_URL=http://localhost:3000   # dùng cho stripe-success.html / stripe-cancel.html

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
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # json một dòng
```

## Scripts hữu ích
- `npm run dev` / `npm start`: khởi động server.
- `npm run lint`: kiểm tra ESLint.
- `npm run typecheck`: kiểm tra kiểu TypeScript.
- `npm test` / `npm run test:ci`: chạy Jest.
- `npm run build`: biên dịch TS (không tự động chạy server).

## Chạy bằng Docker
```sh
docker build -t backend-mobile .
docker run --env-file .env -p 3000:3000 backend-mobile
```
Container dùng `NODE_ENV=production` và chạy `npm start`. Đảm bảo `.env` đủ key trước khi run.

## Smoke test nhanh
- GET `http://localhost:3000/` nhận string "Server running...".
- Mở `http://localhost:3000/api-docs` xem Swagger.  
- Nếu thiếu `MONGO_URI` server sẽ dừng ngay khi start (xem log).
