# Chatify — Ứng dụng chat real-time (kiến trúc microservices)

Dự án **Chatify** là hệ thống chat web gồm nhiều dịch vụ độc lập: xác thực người dùng, phòng và tin nhắn (REST + WebSocket/STOMP), upload file qua object storage, bạn bè, và thông báo đẩy. Giao diện **Angular** gọi API qua **Spring Cloud Gateway**; mỗi service có database phù hợp (PostgreSQL / MongoDB / Redis) và triển khai gom nhóm bằng **Docker Compose**.

---

## Tính năng chính

- Đăng ký, đăng nhập, xác thực email, làm mới token / hồ sơ người dùng (`auth-service`)
- Chat 1-1 và nhóm: phòng (`/rooms/**`), tin nhắn (`/messages/**`), đánh dấu đã đọc, phản ứng, thành viên nhóm (`chat-service` + MongoDB)
- Real-time qua **WebSocket** endpoint `/ws`, STOMP destination ứng dụng `/app`, ví dụ `@MessageMapping("/chat")`
- Upload file **multipart** tới `POST /api/v1/media/upload` lưu qua **MinIO** (`media-service`)
- Bạn bè: lời mời, danh sách bạn, chặn / bỏ chặn, gợi ý (chi tiết API: [friend-service/README.md](friend-service/README.md))
- Thông báo: đăng ký FCM token và gửi thông báo (`notification-service` + Redis + Firebase)
- Giao diện **Angular 21**, Tailwind, RxStomp/SockJS, Firebase Web SDK (xem thêm [chat-client/README.md](chat-client/README.md))

---

## Ảnh minh hoạ và sơ đồ kiến trúc

README này **không** nhúng biểu đồ hay screenshot. Bạn có thể thêm vào cuối file (hoặc tạo thư mục `docs/`) các ảnh đã chuẩn bị — ví dụ sơ đồ tổng thể (Cloudflare Tunnel → frontend / gateway → từng service), ảnh trang đăng nhập–đăng ký, giao diện chat, cuộc gọi thoại — bằng Markdown: `![Mô tả ngắn](docs/ten-file.png)`. Nên dùng đường dẫn tương đối trong repo để GitHub hiển thị đúng.

---

## Kiến trúc tổng quan (mô tả bằng chữ)

Người dùng truy cập qua trình duyệt (hoặc thiết bị di động nếu có). Khi triển khai công khai, **Cloudflare Tunnel** có thể đóng vai trò điểm vào an toàn: tách luồng **tài nguyên tĩnh** (giao diện) và luồng **API / WebSocket** tới backend.

**Frontend:** ứng dụng **Angular** được đóng gói và phục vụ tĩnh qua **Nginx** (trong Docker Compose, cổng host thường là **3000**). Giao diện hỗ trợ tiếng Việt (đăng nhập, đăng ký, chat, gọi thoại, v.v.).

**Cổng API:** **Spring Cloud Gateway** (cổng **8080**) là trung tâm định tuyến: mọi REST và WebSocket STOMP từ client (khi cấu hình trỏ tới gateway) đi qua đây. Gateway áp dụng **JWT** cho hầu hết route; WebSocket hỗ trợ token qua query `?token=...` (xử lý trong `AuthenticationFilter`).

**Các microservice phía sau gateway:**

1. **auth-service (8081)** — đăng ký, đăng nhập, người dùng; dữ liệu trên **PostgreSQL** (`authdb`).
2. **chat-service (8082)** — phòng chat, tin nhắn, WebSocket `/ws`; dữ liệu trên **MongoDB** (`chatdb`). Có tương tác nội bộ với dịch vụ xác thực / thông báo tùy luồng nghiệp vụ (ví dụ gọi notification-service).
3. **media-service (8083)** — upload và metadata file; **PostgreSQL** (`mediadb`) + **MinIO** (object storage, bucket cấu hình trong Compose).
4. **notification-service (8084 trên host, trong container thường 8080)** — token FCM, gửi thông báo; dùng **Redis** và tích hợp **Firebase Cloud Messaging**.
5. **friend-service (8085)** — bạn bè, chặn, lời mời; **PostgreSQL** (`frienddb`).

Luồng tóm tắt: client → (tuỳ chọn tunnel) → **Angular/Nginx** cho UI; client → **Gateway** cho `/api/**`, `/rooms/**`, `/messages/**`, `/ws/**`, v.v. → từng service → database hoặc MinIO/Redis/Firebase tương ứng.

---

## Thành phần & cổng (Docker Compose trên máy host)

| Thành phần | Container | Port host | Ghi chú |
|------------|-----------|-----------|---------|
| API Gateway | `api-gateway` | **8080** | Cổng duy nhất client cần (API + WS qua `/ws`) |
| Auth | `auth-service` | 8081 | PostgreSQL `authdb` |
| Chat | `chat-service` | 8082 | MongoDB `chatdb` |
| Media | `media-service` | 8083 | PostgreSQL `mediadb` + MinIO |
| Notification | `notification-service` | **8084** → container 8080 | Redis |
| Friend | `friend-service` | 8085 | PostgreSQL `frienddb` |
| Frontend (nginx) | `chat-frontend` | **3000** → 80 | Build từ `chat-client` |
| PostgreSQL (auth) | `postgres-db` | 5432 | DB `authdb` |
| PostgreSQL (media) | `media-db` | 5434 | DB `mediadb` |
| PostgreSQL (friend) | `friend-db` | 5435 | DB `frienddb` |
| MongoDB | `chat-mongo` | 27017 | |
| Redis | `chat-redis` | 6379 | |
| MinIO API / Console | `minio` | 9000 / 9001 | Bucket mặc định ví dụ `chatapp-files` |
| Cloudflare Tunnel | `cloudflare-tunnel` | — | Tùy chọn; cần token hợp lệ |

Chi tiết image, biến môi trường và volume: [docker-compose.yml](docker-compose.yml).

---

## Yêu cầu môi trường

- **JDK 17**, **Maven 3.x**
- **Node.js** + **npm** (khuyến nghị đúng phiên bản ghi trong [chat-client/package.json](chat-client/package.json) — `packageManager`)
- **Docker** và **Docker Compose** (plugin `docker compose` hoặc bản `docker-compose` cũ)

---

## Chạy nhanh với Docker

Tại thư mục gốc repo:

```bash
docker compose up --build
```

Sau khi các container healthy:

- **Frontend:** http://localhost:3000  
- **API + WebSocket (qua gateway):** http://localhost:8080 — WebSocket STOMP endpoint qua gateway: `ws://localhost:8080/ws` (hoặc `wss://` khi có TLS)

**Lưu ý:** Service `tunnel` trong Compose dùng cho expose ra Internet; nếu chỉ dev local có thể tạm comment service đó hoặc không truyền token thật (xem mục bảo mật).

---

## Chạy phát triển local (không Docker, tùy chọn)

1. Khởi chạy PostgreSQL, MongoDB, Redis, MinIO (hoặc chỉ chạy các container DB từ Compose và chạy từng service Java local).
2. Mỗi microservice: vào thư mục tương ứng, cấu hình `application.yml` / biến môi trường trỏ tới DB và URL dịch vụ phụ thuộc, rồi:

   ```bash
   mvn spring-boot:run
   ```

3. **Gateway** phải trỏ URI tới hostname thật của các service (trong Docker là tên service; local thường là `localhost` + port khác nhau — có thể cần chỉnh [api-gateway/src/main/resources/application.yaml](api-gateway/src/main/resources/application.yaml) tạm thời cho dev).

4. **Angular** — mặc định `ng serve` dùng cấu hình **development**, thay file [chat-client/src/environments/environment.ts](chat-client/src/environments/environment.ts) bằng nội dung từ [chat-client/src/environments/environment.development.ts](chat-client/src/environments/environment.development.ts) (xem `fileReplacements` trong [chat-client/angular.json](chat-client/angular.json)):

   ```bash
   cd chat-client
   npm install
   npm start
   ```

   Ứng dụng: http://localhost:4200  

   Để gọi API local qua gateway, trong file environment dùng cho dev nên đặt ví dụ:

   - `apiUrl: 'http://localhost:8080'`
   - `wsUrl: 'ws://localhost:8080/ws'`

   (Hiện tại một số file environment có thể đang trỏ tới domain deploy; cần chỉnh tay cho đúng môi trường.)

**CORS:** Gateway cho phép các origin cấu hình trong [api-gateway/src/main/resources/application.yaml](api-gateway/src/main/resources/application.yaml) (ví dụ `http://localhost:4200`). Khi thêm domain mới, cập nhật `spring.cloud.gateway.globalcors` tương ứng.

---

## Định tuyến API Gateway

Cấu hình trong [api-gateway/src/main/resources/application.yaml](api-gateway/src/main/resources/application.yaml):

| Prefix (qua gateway) | Dịch vụ đích |
|----------------------|--------------|
| `/api/auth/**` | auth-service |
| `/api/users/**` | auth-service (+ JWT) |
| `/messages/**`, `/rooms/**` | chat-service (+ JWT cho REST) |
| `/ws/**` | chat-service (WebSocket; token query/header theo filter) |
| `/api/v1/media/**` | media-service (+ JWT) |
| `/api/notifications/**` | notification-service |
| `/api/friends/**` | friend-service (+ JWT) |
| `/chatapp-files/**` | MinIO (truy cập file; route không gắn `AuthenticationFilter` trong cấu hình hiện tại) |

### Endpoint công khai (không JWT trên gateway)

Theo [RouteValidator.java](api-gateway/src/main/java/com/chatapp/api_gateway/filter/RouteValidator.java), chỉ các path chứa chuỗi sau được coi là mở:

- `/api/auth/register`
- `/api/auth/login`
- `/eureka`

Mọi request khác đi qua filter bảo vệ (khi route có `AuthenticationFilter`) cần **Bearer token** hợp lệ (hoặc token query cho WS).

### REST tiêu biểu (để tra cứu nhanh)

- **Auth / user:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/auth/verify`, … — [AuthController](auth-service/src/main/java/com/chatapp/auth_service/controller/AuthController.java), [UserController](auth-service/src/main/java/com/chatapp/auth_service/controller/UserController.java)
- **Chat:** `GET/POST ...` dưới `/rooms/**`, `/messages/**` — [ChatController](chat-service/src/main/java/com/chatapp/chat_service/controller/ChatController.java)
- **Media:** `POST /api/v1/media/upload` — [MediaController](media-service/src/main/java/com/chatapp/media_service/controller/MediaController.java)
- **Notification:** `POST /api/notifications/token`, `POST /api/notifications/send` — [NotificationController](notification-service/src/main/java/com/chatapp/notification_service/controller/NotificationController.java)
- **Friends:** xem bảng đầy đủ trong [friend-service/README.md](friend-service/README.md)

### WebSocket / STOMP

- Endpoint SockJS/STOMP: **`/ws`** (qua gateway: cùng host/port với API).
- Prefix gửi message từ client: **`/app`** (ví dụ destination tương ứng `@MessageMapping("/chat")` → `/app/chat`).
- Cấu hình: [WebSocketConfig.java](chat-service/src/main/java/com/chatapp/chat_service/config/WebSocketConfig.java).

---

## Biến môi trường (tham chiếu)

Không đưa secret thật vào Git. Dưới đây là **tên** biến thường dùng (giá trị mẫu chỉ mang tính minh họa — thay bằng secret riêng):

| Khu vực | Biến (ví dụ) |
|---------|----------------|
| Gateway / Auth / Friend | `JWT_SECRET`, `JWT_EXPIRATION_MS` |
| Auth DB | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `SERVER_PORT` |
| Auth app | `APP_VERIFICATION_URL`, `APP_FRONTEND_URL`, `APP_BASE_URL`, `MAIL_USERNAME`, `MAIL_PASSWORD` |
| Chat | `SPRING_DATA_MONGODB_URI`, `NOTIFICATION_SERVICE_URL`, `SERVER_PORT` |
| Media | `MINIO_URL`, `MINIO_PUBLIC_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` + datasource |
| Friend | `AUTH_SERVICE_URL`, `NOTIFICATION_SERVICE_URL` + datasource |
| Notification | `SPRING_DATA_REDIS_HOST`, `SPRING_DATA_REDIS_PORT`, `APP_FIREBASE_CONFIG` |
| Tunnel | `TUNNEL_TOKEN` (Cloudflare) |

PostgreSQL trong Compose: các DB `authdb`, `mediadb`, `frienddb`; user/password mặc định cần đổi trước khi public repo.

**Firebase:** `notification-service` cần file khóa dịch vụ (ví dụ `firebase-service-account.json`) — **không commit** file này; chỉ mô tả trong tài liệu hoặc dùng secret manager.

---

## Build frontend production

```bash
cd chat-client
npm install
npm run build
```

Artifact nằm trong thư mục output của Angular (theo `angular.json`). Image Docker dựng static file qua nginx: [chat-client/Dockerfile](chat-client/Dockerfile).

---

## Cấu trúc thư mục repo

- `api-gateway/` — Spring Cloud Gateway  
- `auth-service/` — xác thực & người dùng  
- `chat-service/` — chat & WebSocket  
- `chat-client/` — Angular SPA  
- `friend-service/` — bạn bè  
- `media-service/` — file & MinIO  
- `notification-service/` — FCM & Redis  
- `docker-compose.yml` — orchestration toàn stack  
- `README.md` — tài liệu này  

---

## Bảo mật & lưu ý khi đưa lên GitHub

- **Không commit:** mật khẩu email, JWT secret production, token Cloudflare Tunnel, khóa MinIO/DB thật, `firebase-service-account.json`.
- File [docker-compose.yml](docker-compose.yml) trong repo có thể đang chứa giá trị nhạy cảm — trước khi public: **xoay (rotate)** mọi secret đã lộ, chuyển sang `.env` + `env_file` hoặc biến CI, và thay trong Compose bằng placeholder.
- `JWT_SECRET` phải thống nhất giữa các service ký/kiểm tra token (gateway, auth, friend, …).
- README này **không** nhúng khóa API Firebase hay VAPID; cấu hình Firebase chỉ nên nằm trong environment build hoặc secret.

---

## Tài liệu thêm trong repo

- [chat-client/README.md](chat-client/README.md) — Angular CLI, `ng serve`, test, build.
- [friend-service/README.md](friend-service/README.md) — API bạn bè, schema DB, ví dụ `curl`, tích hợp gateway.

---

## Tác giả / đồ án

*(Điền tên sinh viên, lớp, trường, năm học.)*

## License

*(Tuỳ chọn — MIT, hoặc theo quy định trường.)*
