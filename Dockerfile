# ---- deps: cài prod deps (để copy sang runner)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- builder: build TS -> dist
FROM node:20-alpine AS builder
WORKDIR /app

# Chỉ copy những gì cần để cache tốt
COPY package*.json ./
RUN npm ci

# Copy cấu hình TS + source
COPY tsconfig*.json ./
COPY src ./src

# Build ra dist
RUN npm run build

# (tuỳ chọn) kiểm tra dist có thật
RUN ls -la dist

# ---- runner: ảnh chạy thật
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]

