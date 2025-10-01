# Sử dụng Node.js nhẹ (Alpine)
FROM node:18-alpine

# Thư mục làm việc trong container
WORKDIR /app

# Copy package.json trước để cache dependencies
COPY package*.json ./

# Cài dependencies
RUN npm install --production

# Copy toàn bộ source code vào container
COPY . .

# Mở port (ví dụ 3000, nếu app bạn dùng khác thì chỉnh)
EXPOSE 3000

# Chạy app
CMD ["npm", "start"]

