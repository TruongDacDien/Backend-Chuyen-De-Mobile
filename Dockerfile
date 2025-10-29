# --- Base image
FROM node:20-alpine AS base
WORKDIR /app

# Chỉ copy file manifest trước để tận dụng cache
COPY package*.json ./

# Cài deps production
RUN npm ci --omit=dev

# Copy toàn bộ source vào image
COPY . .

# Tùy chọn: ép production
ENV NODE_ENV=production

# App của bạn listen 3000
EXPOSE 3000

# Khởi động
CMD ["npm", "start"]
