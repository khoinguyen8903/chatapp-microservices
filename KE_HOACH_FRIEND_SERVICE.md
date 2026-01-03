# KẾ HOẠCH TRIỂN KHAI FRIEND-SERVICE
## TÍNH NĂNG KẾT BẠN - MICROSERVICE ARCHITECTURE

---

## 📋 TỔNG QUAN DỰ ÁN

Dự án hiện tại là một microservices architecture với các thành phần:
- **auth-service**: Quản lý xác thực, người dùng
- **chat-service**: Quản lý tin nhắn, cuộc trò chuyện
- **media-service**: Quản lý media files
- **notification-service**: Quản lý thông báo
- **api-gateway**: Cổng kết nối API
- **chat-client**: Frontend Angular

**Mục tiêu**: Thêm `friend-service` mới để quản lý tính năng kết bạn giữa người dùng.

---

## 🎯 PHẦN 1: CẤU TRÚC THƯ MỤC FRIEND-SERVICE

```
friend-service/
├── src/
│   └── main/
│       ├── java/
│       │   └── com/
│       │       └── chatapp/
│       │           └── friend_service/
│       │               ├── FriendServiceApplication.java          # Main Application
│       │               ├── config/
│       │               │   └── SecurityConfig.java               # Cấu hình bảo mật
│       │               ├── controller/
│       │               │   ├── FriendController.java             # API cho kết bạn
│       │               │   ├── FriendRequestController.java      # API cho lời mời kết bạn
│       │               │   └── FriendRecommendationController.java # API gợi ý bạn bè
│       │               ├── dto/
│       │               │   ├── FriendRequestDTO.java            # DTO gửi lời mời
│       │               │   ├── FriendResponseDTO.java            # DTO phản hồi lời mời
│       │               │   ├── FriendStatusDTO.java             # DTO trạng thái bạn bè
│       │               │   ├── UserDTO.java                     # DTO thông tin user
│       │               │   └── RecommendationDTO.java           # DTO gợi ý bạn
│       │               ├── entity/
│       │               │   ├── Friendship.java                  # Entity mối quan hệ bạn bè
│       │               │   ├── FriendRequest.java                # Entity lời mời kết bạn
│       │               │   └── BlockedUser.java                  # Entity chặn user
│       │               ├── enums/
│       │               │   ├── FriendStatus.java                # Enum trạng thái: PENDING, ACCEPTED, BLOCKED
│       │               │   └── RequestStatus.java                # Enum trạng thái lời mời: PENDING, ACCEPTED, REJECTED
│       │               ├── repository/
│       │               │   ├── FriendshipRepository.java        # Repository cho mối quan hệ
│       │               │   ├── FriendRequestRepository.java      # Repository cho lời mời
│       │               │   └── BlockedUserRepository.java       # Repository cho user bị chặn
│       │               ├── service/
│       │               │   ├── FriendService.java               # Service logic chính
│       │               │   ├── FriendRequestService.java        # Service quản lý lời mời
│       │               │   ├── BlockedUserService.java           # Service chặn user
│       │               │   └── RecommendationService.java       # Service gợi ý bạn
│       │               ├── exception/
│       │               │   ├── AlreadyFriendsException.java      # Exception đã là bạn
│       │               │   ├── RequestAlreadyExistsException.java # Exception lời mời tồn tại
│       │               │   └── GlobalExceptionHandler.java      # Xử lý exception toàn cục
│       │               └── client/
│       │                   ├── AuthClient.java                   # Feign Client gọi auth-service
│       │                   └── NotificationClient.java           # Feign Client gọi notification-service
│       └── resources/
│           └── application.yaml                                 # Cấu hình ứng dụng
├── Dockerfile                                                    # Docker image
├── HELP.md                                                       # Hướng dẫn sử dụng
├── mvnw                                                         # Maven wrapper
├── mvnw.cmd                                                     # Maven wrapper Windows
└── pom.xml                                                       # Maven configuration
```

---

## 📝 PHẦN 2: CÁC FILE CẦN TẠO MỚI

### 2.1. File cấu hình Maven - `pom.xml`

**Dependencies cần thiết:**
```xml
- spring-boot-starter-web
- spring-boot-starter-data-jpa
- spring-boot-starter-security
- spring-boot-starter-validation
- postgresql
- lombok
- spring-boot-starter-openfeign (để gọi các service khác)
- spring-cloud-starter-circuitbreaker-resilience4j
```

### 2.2. Application Configuration - `application.yaml`

**Cấu hình cần thiết:**
```yaml
server:
  port: 8085
spring:
  application:
    name: friend-service
  datasource:
    url: jdbc:postgresql://friend-db:5432/frienddb
    username: postgres
    password: 123456
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
  cloud:
    openfeign:
      client:
        config:
          default:
            connectTimeout: 5000
            readTimeout: 5000
auth-service:
  url: http://auth-service:8081
notification-service:
  url: http://notification-service:8080
```

---

## 🗄️ PHẦN 3: DATABASE DESIGN

### 3.1. Bảng `friendships`

```sql
CREATE TABLE friendships (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    friend_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL, -- ACCEPTED, BLOCKED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, friend_id)
);

CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

### 3.2. Bảng `friend_requests`

```sql
CREATE TABLE friend_requests (
    id VARCHAR(36) PRIMARY KEY,
    sender_id VARCHAR(36) NOT NULL,
    receiver_id VARCHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL, -- PENDING, ACCEPTED, REJECTED
    message VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
```

### 3.3. Bảng `blocked_users`

```sql
CREATE TABLE blocked_users (
    id VARCHAR(36) PRIMARY KEY,
    blocker_id VARCHAR(36) NOT NULL,
    blocked_id VARCHAR(36) NOT NULL,
    reason VARCHAR(500),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX idx_blocked_users_blocker ON blocked_users(blocker_id);
CREATE INDEX idx_blocked_users_blocked ON blocked_users(blocked_id);
```

---

## 🔧 PHẦN 4: CÁC ENTITY (LAYER MODEL)

### 4.1. `Friendship.java`
- Fields: id, userId, friendId, status, createdAt, updatedAt
- Status enum: ACCEPTED, BLOCKED

### 4.2. `FriendRequest.java`
- Fields: id, senderId, receiverId, status, message, createdAt, updatedAt
- Status enum: PENDING, ACCEPTED, REJECTED

### 4.3. `BlockedUser.java`
- Fields: id, blockerId, blockedId, reason, blockedAt

---

## 📦 PHẦN 5: CÁC DTO (DATA TRANSFER OBJECTS)

### 5.1. `FriendRequestDTO.java`
```java
public class FriendRequestDTO {
    private String receiverId;
    private String message;
}
```

### 5.2. `FriendResponseDTO.java`
```java
public class FriendResponseDTO {
    private String id;
    private String senderId;
    private String receiverId;
    private String status;
    private String message;
    private LocalDateTime createdAt;
}
```

### 5.3. `FriendStatusDTO.java`
```java
public class FriendStatusDTO {
    private String userId;
    private String status; // NOT_FRIENDS, PENDING_REQUEST, ARE_FRIENDS, BLOCKED
    private boolean canSendRequest;
}
```

### 5.4. `UserDTO.java`
```java
public class UserDTO {
    private String id;
    private String username;
    private String fullName;
    private String avatarUrl;
}
```

---

## 🎛️ PHẦN 6: CÁC API ENDPOINTS

### 6.1. Friend Request Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/friends/request` | Gửi lời mời kết bạn | Yes |
| GET | `/api/friends/requests/received` | Lấy danh sách lời mời đã nhận | Yes |
| GET | `/api/friends/requests/sent` | Lấy danh sách lời mời đã gửi | Yes |
| PUT | `/api/friends/requests/{requestId}/accept` | Chấp nhận lời mời kết bạn | Yes |
| PUT | `/api/friends/requests/{requestId}/reject` | Từ chối lời mời kết bạn | Yes |
| DELETE | `/api/friends/requests/{requestId}` | Hủy lời mời kết bạn | Yes |

### 6.2. Friend Management Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/friends` | Lấy danh sách bạn bè | Yes |
| GET | `/api/friends/{friendId}/status` | Kiểm tra trạng thái bạn bè | Yes |
| DELETE | `/api/friends/{friendId}` | Hủy kết bạn | Yes |
| POST | `/api/friends/{userId}/block` | Chặn người dùng | Yes |
| DELETE | `/api/friends/{userId}/block` | Bỏ chặn người dùng | Yes |
| GET | `/api/friends/blocked` | Lấy danh sách đã chặn | Yes |

### 6.3. Friend Recommendation Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/friends/recommendations` | Lấy danh sách gợi ý kết bạn | Yes |
| GET | `/api/friends/search` | Tìm kiếm người dùng | Yes |

---

## 🔐 PHẦN 7: BẢO MẬT VÀ XÁC THỰC

### 7.1. JWT Token Validation
- Tạo `JwtFilter` để xác thực token
- Gọi `auth-service` để validate token
- Lấy thông tin user từ JWT token

### 7.2. Authorization Rules
```java
- /api/friends/request → Chỉ user đã đăng nhập
- /api/friends/requests/received → Chỉ user đã đăng nhập
- /api/friends/{friendId}/block → Chỉ chủ tài khoản mới có thể
- Public endpoints: Không có (tất cả đều cần auth)
```

---

## 🔄 PHẦN 8: TÍCH HỢP VỚI CÁC SERVICE KHÁC

### 8.1. Auth Service Integration
- **Feign Client**: `AuthClient`
- **Methods**:
  - `getUserById(userId)` → Lấy thông tin user
  - `validateToken(token)` → Validate JWT token

### 8.2. Notification Service Integration
- **Feign Client**: `NotificationClient`
- **Methods**:
  - `sendFriendRequestNotification(receiverId, senderId)` → Thông báo nhận lời mời
  - `sendFriendAcceptedNotification(senderId, receiverId)` → Thông báo lời mời được chấp nhận

### 8.3. Chat Service Integration
- Khi 2 user trở thành bạn bè → Tự động tạo chat room (optional)
- Khi hủy kết bạn → Xóa chat room (optional)

---

## 🐳 PHẦN 9: DOCKER & KỶCH BẢN TRIỂN KHAI

### 9.1. Thêm vào `docker-compose.yml`

```yaml
# --- FRIEND SERVICE ---
friend-service:
  build: ./friend-service
  container_name: friend-service
  ports:
    - "8085:8085"
  networks:
    - app-network
  depends_on:
    - friend-db
    - auth-service
  deploy:
    resources:
      limits:
        memory: 768M
      reservations:
        memory: 384M
  environment:
    SERVER_PORT: 8085
    SPRING_DATASOURCE_URL: jdbc:postgresql://friend-db:5432/frienddb
    SPRING_DATASOURCE_USERNAME: postgres
    SPRING_DATASOURCE_PASSWORD: 123456
    AUTH_SERVICE_URL: http://auth-service:8081
    NOTIFICATION_SERVICE_URL: http://notification-service:8080
    JWT_SECRET: "mysecretkey123456789012345678901234"
    JAVA_OPTS: "-Xms384m -Xmx600m"

# --- FRIEND DATABASE ---
friend-db:
  image: postgres:15
  container_name: friend-db
  ports:
    - "5435:5432"
  networks:
    - app-network
  deploy:
    resources:
      limits:
        memory: 512M
      reservations:
        memory: 256M
  environment:
    POSTGRES_DB: frienddb
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: 123456
    TZ: Asia/Ho_Chi_Minh
  volumes:
    - friend_data:/var/lib/postgresql/data
  command: ["postgres", "-c", "shared_buffers=128MB", "-c", "max_connections=100"]
```

### 9.2. Thêm volume vào `docker-compose.yml`

```yaml
volumes:
  postgres_data:
  chat_mongo_data:
  media_data:
  minio_data:
  friend_data:  # ← Thêm mới
```

---

## 🌐 PHẦN 10: API GATEWAY CẤU HÌNH

### 10.1. Thêm route cho friend-service trong `api-gateway`

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: friend-service
          uri: lb://friend-service
          predicates:
            - Path=/api/friends/**
          filters:
            - StripPrefix=0
```

### 10.2. Update dependencies trong `api-gateway/pom.xml`

```xml
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>
```

---

## 📱 PHẦN 11: FRONTEND INTEGRATION (ANGULAR)

### 11.1. Các file cần tạo mới trong `chat-client/src/app/`

```
pages/
├── friends/
│   ├── friends.component.ts
│   ├── friends.component.html
│   ├── friends.component.scss
│   ├── friend-requests.component.ts
│   ├── friend-requests.component.html
│   ├── friend-requests.component.scss
│   ├── find-friends.component.ts
│   ├── find-friends.component.html
│   └── find-friends.component.scss
```

### 11.2. Service mới trong `chat-client/src/app/services/`

```
services/
└── friend.service.ts
```

**Methods trong `friend.service.ts`:**
```typescript
- sendFriendRequest(receiverId, message)
- getReceivedRequests()
- getSentRequests()
- acceptRequest(requestId)
- rejectRequest(requestId)
- cancelRequest(requestId)
- getFriends()
- getFriendStatus(userId)
- unfriend(friendId)
- blockUser(userId)
- unblockUser(userId)
- getBlockedUsers()
- getRecommendations()
- searchUsers(query)
```

### 11.3. Cập nhật routing trong `app.routes.ts`

```typescript
{
  path: 'friends',
  loadChildren: () => import('./pages/friends').then(m => m.FriendsModule)
}
```

### 11.4. Các component cần tạo:

1. **FriendsListComponent** - Hiển thị danh sách bạn bè
2. **FriendRequestsComponent** - Hiển thị lời mời kết bạn
3. **FindFriendsComponent** - Tìm kiếm người dùng mới
4. **FriendProfileComponent** - Xem profile và gửi lời mời
5. **BlockedUsersComponent** - Quản lý danh sách chặn

---

## 🧪 PHẦN 12: TESTING

### 12.1. Unit Tests
- Test tất cả service methods
- Test repository methods
- Test DTO validation

### 12.2. Integration Tests
- Test API endpoints
- Test integration với auth-service
- Test integration với notification-service

### 12.3. Test Cases chính:

1. **Gửi lời mời kết bạn:**
   - Thành công khi chưa kết bạn
   - Thất bại khi đã là bạn
   - Thất bại khi đã gửi lời mời
   - Thất bại khi bị user chặn

2. **Chấp nhận lời mời:**
   - Thành công tạo mối quan hệ bạn bè
   - Gửi thông báo cho người gửi
   - Xóa lời mời sau khi chấp nhận

3. **Hủy kết bạn:**
   - Xóa mối quan hệ bạn bè
   - Cả hai user không còn trong danh sách bạn

4. **Chặn user:**
   - User bị chặn không thể gửi lời mời
   - User bị chặn không thể nhắn tin
   - Xóa mối quan hệ bạn bè (nếu có)

---

## 🚀 PHẦN 13: LỘ TRÌNH TRIỂN KHAI (IMPLEMENTATION ROADMAP)

### Phase 1: Foundation (2-3 ngày)
- [ ] ✅ Tạo cấu trúc thư mục friend-service
- [ ] ✅ Setup pom.xml với dependencies cần thiết
- [ ] ✅ Cấu hình application.yaml
- [ ] ✅ Tạo Main Application class
- [ ] ✅ Setup database với Docker

### Phase 2: Database & Entities (1-2 ngày)
- [ ] ✅ Tạo các Entity classes (Friendship, FriendRequest, BlockedUser)
- [ ] ✅ Tạo Enums (FriendStatus, RequestStatus)
- [ ] ✅ Tạo Repository interfaces
- [ ] ✅ Test database connection và migrations

### Phase 3: DTOs & Exceptions (1 ngày)
- [ ] ✅ Tạo các DTO classes
- [ ] ✅ Tạo Custom Exception classes
- [ ] ✅ Tạo GlobalExceptionHandler
- [ ] ✅ Test DTO validation

### Phase 4: Service Layer (2-3 ngày)
- [ ] ✅ Implement FriendService
- [ ] ✅ Implement FriendRequestService
- [ ] ✅ Implement BlockedUserService
- [ ] ✅ Implement RecommendationService
- [ ] ✅ Write unit tests cho services

### Phase 5: Controller Layer (1-2 ngày)
- [ ] ✅ Implement FriendController
- [ ] ✅ Implement FriendRequestController
- [ ] ✅ Implement FriendRecommendationController
- [ ] ✅ Test API endpoints với Postman

### Phase 6: Security Integration (1 ngày)
- [ ] ✅ Cấu hình SecurityConfig
- [ ] ✅ Tạo JwtFilter
- [ ] ✅ Implement AuthClient (Feign Client)
- [ ] ✅ Test authentication & authorization

### Phase 7: Notification Integration (1 ngày)
- [ ] ✅ Implement NotificationClient (Feign Client)
- [ ] ✅ Gửi notification khi có lời mời kết bạn
- [ ] ✅ Gửi notification khi lời mời được chấp nhận
- [ ] ✅ Test notification flow

### Phase 8: Docker & Deployment (1 ngày)
- [ ] ✅ Tạo Dockerfile
- [ ] ✅ Cập nhật docker-compose.yml
- [ ] ✅ Test build và run containers
- [ ] ✅ Test service communication trong Docker

### Phase 9: API Gateway Integration (1 ngày)
- [ ] ✅ Cấu hình routing trong api-gateway
- [ ] ✅ Test routes qua API Gateway
- [ ] ✅ Update dependencies

### Phase 10: Frontend Development (3-4 ngày)
- [ ] ✅ Tạo friend.service.ts
- [ ] ✅ Tạo FriendsListComponent
- [ ] ✅ Tạo FriendRequestsComponent
- [ ] ✅ Tạo FindFriendsComponent
- [ ] ✅ Tạo FriendProfileComponent
- [ ] ✅ Cập nhật routing
- [ ] ✅ Styling với Tailwind CSS
- [ ] ✅ Test integration với backend

### Phase 11: Integration Testing (1-2 ngày)
- [ ] ✅ End-to-end testing toàn bộ flow
- [ ] ✅ Test các edge cases
- [ ] ✅ Performance testing
- [ ] ✅ Security testing

### Phase 12: Documentation & Cleanup (1 ngày)
- [ ] ✅ Update README.md
- [ ] ✅ Viết API documentation
- [ ] ✅ Code review và refactor
- [ ] ✅ Deploy to production

---

## 📋 PHẦN 14: CHECKLIST TRƯỚC KHI BẮT ĐẦU

### Prerequisites:
- [ ] Java 17+ được cài đặt
- [ ] Maven 3.6+ được cài đặt
- [ ] Docker và Docker Compose được cài đặt
- [ ] PostgreSQL database running
- [ ] auth-service đang chạy
- [ ] notification-service đang chạy

### Files cần chuẩn bị:
- [ ] Mở docker-compose.yml
- [ ] Mở pom.xml của auth-service để tham khảo dependencies
- [ ] Mở config của một service khác để tham khảo

---

## 🎓 PHẦN 15: GHI CHÚ VÀ TÀI LIỆU THAM KHẢO

### Best Practices:
1. **SOLID Principles**: Áp dụng trong thiết kế service layer
2. **DTO Pattern**: Sử dụng DTO để tách entity và API response
3. **Exception Handling**: Xử lý exception một cách thống nhất
4. **Transaction Management**: Use @Transactional cho các thay đổi database
5. **Caching**: Cân nhắc sử dụng Redis cho caching danh sách bạn bè
6. **Rate Limiting**: Giới hạn số lượng lời mời có thể gửi trong 1 ngày

### Performance Considerations:
- Indexing trên các columns hay query
- Pagination cho danh sách bạn bè
- Caching thông tin user từ auth-service
- Async notification sending

### Security Considerations:
- Validate token cho mọi request
- Kiểm tra quyền sở hữu trước khi cho phép hủy kết bạn
- Rate limit để tránh spam lời mời
- Logging cho audit trail

---

## 📞 PHẦN 16: HỖ TRỢ VÀ TROUBLESHOOTING

### Common Issues:
1. **Database Connection Error**: Kiểm tra postgres-db container
2. **Auth Service Not Reachable**: Kiểm tra network connection trong Docker
3. **JWT Token Invalid**: Kiểm tra JWT_SECRET configuration
4. **Feign Client Timeout**: Tăng timeout trong application.yaml

### Debug Commands:
```bash
# Check logs
docker logs friend-service

# Check database connection
docker exec -it friend-db psql -U postgres -d frienddb -c "\dt"

# Test API endpoint
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/friends
```

---

## ✨ PHẦN 17: FEATURE ENHANCEMENTS (OPTIONAL)

### Tương lai có thể thêm:
1. **Mutual Friends**: Hiển thị bạn chung
2. **Friend Suggestions based on**: 
   - Location
   - Similar interests
   - Common groups
3. **Friend Lists/Categories**: Group bạn bè vào danh sách
4. **Friend Activity**: Hiển thị trạng thái online/offline
5. **Export Friends List**: Xuất danh sách bạn bè
6. **Import Friends**: Từ Facebook, Google Contacts, v.v.

---

## 📊 PHẦN 18: METRICS VÀ MONITORING

### Key Metrics cần theo dõi:
- Số lượng lời mời kết bạn được gửi mỗi ngày
- Tỷ lệ chấp nhận lời mời
- Thời gian trung bình để chấp nhận lời mời
- Số lượng bạn bè trung bình mỗi user
- Thời gian phản hồi API

---

## 🎉 KẾT LUẬN

Kế hoạch này cung cấp một lộ trình chi tiết để triển khai friend-service từ A-Z. Hãy bắt đầu với **Phase 1: Foundation** và tiến theo từng phase để đảm bảo tính ổn định và chất lượng của service.

Good luck! 🚀

