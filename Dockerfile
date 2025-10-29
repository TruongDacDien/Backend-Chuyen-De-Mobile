# =========================
# 1️⃣ Stage: Dependencies
# =========================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# =========================
# 2️⃣ Stage: Builder (chủ yếu cho lint/check)
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

RUN npm run lint || true   # chạy lint nếu có, không làm fail build

# =========================
# 3️⃣ Stage: Runner (chạy app)
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

# Copy node_modules từ deps stage
COPY --from=deps /app/node_modules ./node_modules

# ✅ Copy toàn bộ source code
COPY --from=builder /app ./

EXPOSE 3000
CMD ["npm", "start"]


