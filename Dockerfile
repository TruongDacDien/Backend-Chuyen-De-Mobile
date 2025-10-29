# Dockerfile (ở root backend)
FROM node:20-alpine AS base
WORKDIR /app

# 1) Cài deps bằng cache tốt
COPY package*.json ./
RUN npm ci --omit=dev

# 2) Copy source
COPY . .

# 3) Thiết lập runtime
ENV NODE_ENV=production
EXPOSE 3000

# (khuyến nghị) healthcheck cho Azure
HEALTHCHECK --interval=30s --timeout=3s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# 4) Start
CMD ["npm", "start"]

