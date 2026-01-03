# Friend Service

Friend Service quản lý tính năng kết bạn giữa người dùng trong ứng dụng Chatify.

## 🔥 Tính năng chính

- **Gửi lời mời kết bạn** - Gửi lời mời kết bạn đến người dùng khác
- **Quản lý lời mời** - Xem, chấp nhận, từ chối hoặc hủy lời mời kết bạn
- **Quản lý bạn bè** - Xem danh sách bạn bè, hủy kết bạn
- **Chặn người dùng** - Chặn hoặc bỏ chặn người dùng
- **Gợi ý kết bạn** - Xem gợi ý bạn bè dựa trên bạn của bạn
- **Kiểm tra trạng thái bạn bè** - Kiểm tra xem có phải là bạn bè hay không

## 📡 API Endpoints

### Friend Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/friends/request` | Gửi lời mời kết bạn |
| GET | `/api/friends/requests/received` | Lấy danh sách lời mời đã nhận |
| GET | `/api/friends/requests/sent` | Lấy danh sách lời mời đã gửi |
| PUT | `/api/friends/requests/{requestId}/accept` | Chấp nhận lời mời |
| PUT | `/api/friends/requests/{requestId}/reject` | Từ chối lời mời |
| DELETE | `/api/friends/requests/{requestId}` | Hủy lời mời |

### Friend Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends` | Lấy danh sách bạn bè |
| GET | `/api/friends/{friendId}/status` | Kiểm tra trạng thái bạn bè |
| DELETE | `/api/friends/{friendId}` | Hủy kết bạn |
| POST | `/api/friends/{userId}/block` | Chặn người dùng |
| DELETE | `/api/friends/{userId}/block` | Bỏ chặn người dùng |
| GET | `/api/friends/blocked` | Lấy danh sách đã chặn |

### Recommendations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/friends/recommendations` | Lấy danh sách gợi ý kết bạn |
| GET | `/api/friends/search` | Tìm kiếm người dùng |

## 🔐 Xác thực

Tất cả API endpoints đều yêu cầu JWT token trong header:

```
Authorization: Bearer <your-jwt-token>
```

## 🗄️ Database

Friend Service sử dụng PostgreSQL với 3 bảng chính:

- **friendships** - Lưu trữ mối quan hệ bạn bè
- **friend_requests** - Lưu trữ lời mời kết bạn
- **blocked_users** - Lưu trữ danh sách người dùng bị chặn

## 🔗 Tích hợp

- **Auth Service** - Lấy thông tin người dùng
- **Notification Service** - Gửi thông báo khi có lời mời kết bạn

## 🚀 Local Development

### Build service

```bash
cd friend-service
mvn clean package
```

### Chạy với Docker Compose

```bash
docker-compose up -d friend-service friend-db
```

### Test API với Postman

1. Login để lấy JWT token từ auth-service
2. Gửi request đến các endpoint với token

## 📝 Các ví dụ request

### Gửi lời mời kết bạn

```bash
POST http://localhost:8080/api/friends/request
Authorization: Bearer <token>
Content-Type: application/json

{
  "receiverId": "user-uuid-here",
  "message": "Let's be friends!"
}
```

### Lấy danh sách bạn bè

```bash
GET http://localhost:8080/api/friends
Authorization: Bearer <token>
```

### Chấp nhận lời mời

```bash
PUT http://localhost:8080/api/friends/requests/{requestId}/accept
Authorization: Bearer <token>
```

## 🐳 Docker Configuration

- **Port**: 8085
- **Database**: friend-db (PostgreSQL 15)
- **Network**: app-network

## 📊 Monitoring

Service có các endpoint health check mặc định của Spring Boot:

- `/actuator/health` - Kiểm tra sức khỏe của service
- `/actuator/metrics` - Các metrics của application

## 🔧 Troubleshooting

### Service không start được

Kiểm tra database connection:
```bash
docker logs friend-db
```

### Không thể kết nối đến auth-service

Kiểm tra network connection:
```bash
docker network inspect app-network
```

### JWT token invalid

Kiểm tra JWT_SECRET trong docker-compose.yml phải giống với auth-service

## 📞 Support

Nếu gặp vấn đề, vui lòng kiểm tra:
1. Logs của friend-service: `docker logs friend-service`
2. Logs của friend-db: `docker logs friend-db`
3. Logs của api-gateway: `docker logs api-gateway`

