# --- Giai đoạn 1: Build Angular ---
# Sử dụng Node.js để build code TypeScript thành HTML/CSS/JS
FROM node:22-alpine as build

WORKDIR /app

# Copy package.json và cài đặt dependencies trước (để tận dụng cache của Docker)
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Thực hiện build (kết quả sẽ nằm trong thư mục dist/)
RUN npm run build

# --- Giai đoạn 2: Chạy ứng dụng bằng Nginx ---
# Sử dụng Nginx nhẹ để phục vụ file tĩnh (Production ready)
FROM nginx:alpine

# Copy kết quả build từ giai đoạn 1 sang thư mục phục vụ web của Nginx
# LƯU Ý: Với Angular 17+ mới nhất, đường dẫn build thường là dist/chat-client/browser
# Nếu bạn dùng bản cũ hơn, có thể bỏ đuôi /browser đi (kiểm tra trong file angular.json mục outputPath)
COPY --from=build /app/dist/chat-client/browser /usr/share/nginx/html

# Copy file cấu hình Nginx (bạn cần tạo file nginx.conf này) vào container
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Mở cổng 80 (Cổng mặc định của Nginx)
EXPOSE 80

# Chạy Nginx
CMD ["nginx", "-g", "daemon off;"]