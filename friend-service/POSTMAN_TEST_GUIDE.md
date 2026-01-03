# Hướng Dẫn Test Friend Service API với Postman

## 📋 Chuẩn Bị

### 1. Cài đặt Postman
- Tải Postman tại: https://www.postman.com/downloads/
- Đăng nhập hoặc tiếp tục mà không cần tài khoản

### 2. Tạo Environment trong Postman

1. Mở Postman → Click vào icon gear (Manage Environments)
2. Click **"Create"** để tạo environment mới
3. Đặt tên: `Chatify Development`
4. Thêm các variables sau:

| Variable Name | Initial Value | Description |
|---------------|----------------|-------------|
| `baseUrl` | `https://api.chatify.asia` | API Gateway URL |
| `authToken` | `{{token}}` | JWT Token (sẽ điền sau) |
| `userId` | `{{userId}}` | User ID (sẽ điền sau) |
| `requestId` | `{{requestId}}` | Friend Request ID (sẽ điền sau) |
| `friendId` | `{{friendId}}` | Friend ID (sẽ điền sau) |

5. Click **"Save"**

### 3. Thiết lập Collection

1. Tạo Collection mới với tên: `Friend Service API`
2. Set Collection Level Variables (nếu cần)

---

## 🔐 BƯỚC 0: Xác Thực (Login)

### Endpoint: Login

**Request Details:**
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/auth/login`
- **Header**: `Content-Type: application/json`

**Body (raw JSON):**
```json
{
  "username": "your_username",
  "password": "your_password"
}
```

**Steps:**
1. Paste URL vào Postman
2. Chọn method `POST`
3. Click tab **"Body"** → chọn **"raw"** → chọn **"JSON"**
4. Paste JSON body với username/password của bạn
5. Click **"Send"**

**Expected Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "username": "your_username",
  "fullName": "Your Full Name"
}
```

**⚠️ QUAN TRỌNG:**
- Copy **token** từ response
- Lưu token vào environment variable `authToken`:
  - Click vào **"eye"** icon ở góc trên
  - Click vào biến `authToken`
  - Paste token vào "Current Value"
  - Click **"Save"**

---

## 📝 BƯỚC 1: Lấy User ID của bạn

### Endpoint: Get Current User Profile

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/users/profile`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Paste URL vào Postman
2. Chọn method `GET`
3. Click tab **"Headers"**
4. Add header mới:
   - Key: `Authorization`
   - Value: `Bearer {{authToken}}`
   - Click **"Save"**
5. Click **"Send"**

**Expected Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "your_username",
  "fullName": "Your Full Name",
  "email": "your_email@example.com",
  "avatarUrl": "https://...",
  "bio": "Your bio",
  "phone": "0123456789"
}
```

**⚠️ QUAN TRỌNG:**
- Copy **id** từ response
- Lưu vào environment variable `userId`

---

## 👥 BƯỚC 2: Gửi Lời Mời Kết Bạn

### Endpoint: Send Friend Request

**Request Details:**
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/friends/request`
- **Headers**:
  - `Authorization: Bearer {{authToken}}`
  - `Content-Type: application/json`

**Body (raw JSON):**
```json
{
  "receiverId": "another_user_id_here",
  "message": "Chào bạn, mình muốn kết bạn!"
}
```

**⚠️ LƯU Ý:**
- `receiverId` phải là UUID của user khác (không phải `{{userId}}` của bạn)
- Bạn cần tạo 2 user để test (hoặc nhờ bạn bè cung cấp ID)

**Steps:**
1. Đăng nhập bằng account **thứ 2** (account người nhận)
2. Lấy ID của account thứ 2 (như Bước 1)
3. Đăng nhập lại bằng account thứ nhất (account người gửi)
4. Paste ID của account thứ 2 vào `receiverId`
5. Click **"Send"**

**Expected Response (200 OK):**
```json
{
  "id": "friend-request-uuid-here",
  "senderId": "your-user-id",
  "receiverId": "receiver-user-id",
  "status": "PENDING",
  "message": "Chào bạn, mình muốn kết bạn!",
  "createdAt": "2025-01-03T10:30:00"
}
```

**Lưu request ID:**
- Copy `id` từ response
- Lưu vào environment variable `requestId`

**Error Cases:**
- `409 Conflict`: Đã là bạn bè hoặc lời mời tồn tại
- `403 Forbidden`: User bị chặn
- `404 Not Found`: User không tồn tại

---

## 📥 BƯỚC 3: Xem Lời Mời Đã Nhận

### Endpoint: Get Received Friend Requests

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/requests/received`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Đăng nhập bằng account **thứ 2** (account người nhận)
2. Update `authToken` với token của account thứ 2
3. Send request

**Expected Response (200 OK):**
```json
[
  {
    "id": "friend-request-uuid",
    "senderId": "sender-user-id",
    "receiverId": "your-user-id",
    "status": "PENDING",
    "message": "Chào bạn, mình muốn kết bạn!",
    "createdAt": "2025-01-03T10:30:00"
  }
]
```

---

## 📤 BƯỚC 4: Xem Lời Mời Đã Gửi

### Endpoint: Get Sent Friend Requests

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/requests/sent`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Đăng nhập lại bằng account **thứ nhất** (account người gửi)
2. Update `authToken` với token của account thứ nhất
3. Send request

**Expected Response (200 OK):**
```json
[
  {
    "id": "friend-request-uuid",
    "senderId": "your-user-id",
    "receiverId": "receiver-user-id",
    "status": "PENDING",
    "message": "Chào bạn, mình muốn kết bạn!",
    "createdAt": "2025-01-03T10:30:00"
  }
]
```

---

## ✅ BƯỚC 5: Chấp Nhận Lời Mời

### Endpoint: Accept Friend Request

**Request Details:**
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/api/friends/requests/{{requestId}}/accept`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Đăng nhập bằng account **thứ 2** (account người nhận)
2. Update `authToken` với token của account thứ 2
3. Sử dụng `requestId` đã lưu từ Bước 2
4. Send request

**Expected Response (200 OK):**
```json
{
  "timestamp": "2025-01-03T10:35:00",
  "status": 200,
  "error": null,
  "message": "Friend request accepted"
}
```

**⚠️ Điều này sẽ:**
- Cập nhật status của request thành `ACCEPTED`
- Tạo 2 bản ghi trong bảng `friendships`
- Gửi notification cho người gửi (nếu notification-service đang chạy)

---

## ❌ BƯỚC 6: Từ Chối Lời Mời (Tùy Chọn)

**Note:** Để test này, bạn cần gửi lời mời mới (Bước 2 với user khác)

### Endpoint: Reject Friend Request

**Request Details:**
- **Method**: `PUT`
- **URL**: `{{baseUrl}}/api/friends/requests/{{requestId}}/reject`
- **Header**: `Authorization: Bearer {{authToken}}`

**Expected Response (200 OK):**
```json
{
  "timestamp": "2025-01-03T10:40:00",
  "status": 200,
  "error": null,
  "message": "Friend request rejected"
}
```

---

## 🗑️ BƯỚC 7: Hủy Lời Mời (Tùy Chọn)

**Endpoint: Cancel Friend Request

**Request Details:**
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/friends/requests/{{requestId}}`
- **Header**: `Authorization: Bearer {{authToken}}`

**⚠️ Chỉ người GỬI mới có thể hủy!**

**Expected Response (204 No Content):**
- No body, status 204

---

## 👫 BƯỚC 8: Lấy Danh Sách Bạn Bè

### Endpoint: Get Friends List

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Đăng nhập bằng **account thứ nhất** hoặc **account thứ hai** (cả hai đều là bạn bè)
2. Send request

**Expected Response (200 OK):**
```json
[
  {
    "id": "friendship-uuid",
    "userId": "your-user-id",
    "friendId": "friend-user-id",
    "friendUsername": "friend_username",
    "friendFullName": "Friend Full Name",
    "friendAvatarUrl": "https://...",
    "status": "ACCEPTED",
    "createdAt": "2025-01-03T10:35:00"
  }
]
```

---

## 🔍 BƯỚC 9: Kiểm Tra Trạng Thái Bạn Bè

### Endpoint: Get Friendship Status

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/{{friendId}}/status`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Sử dụng ID của bạn bè từ Bước 8
2. Lưu vào environment variable `friendId`
3. Send request

**Expected Response (200 OK):**
```json
{
  "userId": "friend-user-id",
  "status": "ARE_FRIENDS",
  "canSendRequest": false
}
```

**Các giá trị status có thể:**
- `NOT_FRIENDS` - Không phải bạn bè
- `PENDING_REQUEST` - Có lời mời đang chờ
- `ARE_FRIENDS` - Đã là bạn bè
- `BLOCKED` - Đã bị chặn

---

## 🔒 BƯỚC 10: Chặn Người Dùng

### Endpoint: Block User

**Request Details:**
- **Method**: `POST`
- **URL**: `{{baseUrl}}/api/friends/{{friendId}}/block?reason=Gây phiền`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Sử dụng ID của một user (có thể là bạn bè hoặc user khác)
2. Optional: Thêm `reason` parameter
3. Send request

**Expected Response (200 OK):**
```json
{
  "timestamp": "2025-01-03T11:00:00",
  "status": 200,
  "error": null,
  "message": "User blocked successfully"
}
```

**⚠️ Điều này sẽ:**
- Tạo bản ghi trong bảng `blocked_users`
- Xóa friendship nếu đã là bạn bè
- User bị chặn không thể gửi lời mời

---

## 🔓 BƯỚC 11: Bỏ Chặn Người Dùng

### Endpoint: Unblock User

**Request Details:**
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/friends/{{friendId}}/block`
- **Header**: `Authorization: Bearer {{authToken}}`

**Expected Response (204 No Content):**
- No body, status 204

---

## 🚫 BƯỚC 12: Lấy Danh Sách Đã Chặn

### Endpoint: Get Blocked Users

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/blocked`
- **Header**: `Authorization: Bearer {{authToken}}`

**Expected Response (200 OK):**
```json
[
  {
    "id": "block-uuid",
    "blockerId": "your-user-id",
    "blockedId": "blocked-user-id",
    "reason": "Gây phiền",
    "blockedAt": "2025-01-03T11:00:00"
  }
]
```

---

## 💔 BƯỚC 13: Hủy Kết Bạn

### Endpoint: Unfriend

**Request Details:**
- **Method**: `DELETE`
- **URL**: `{{baseUrl}}/api/friends/{{friendId}}`
- **Header**: `Authorization: Bearer {{authToken}}`

**Steps:**
1. Sử dụng ID của bạn bè
2. Send request

**Expected Response (204 No Content):**
- No body, status 204

**⚠️ Điều này sẽ:**
- Xóa cả hai bản ghi friendship (hai chiều)
- User không còn trong danh sách bạn bè

---

## 💡 BƯỚC 14: Gợi Ý Kết Bạn

### Endpoint: Get Friend Recommendations

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/recommendations`
- **Header**: `Authorization: Bearer {{authToken}}`

**Expected Response (200 OK):**
```json
[
  {
    "user": {
      "id": "user-uuid",
      "username": "recommended_user",
      "fullName": "Recommended User",
      "avatarUrl": "https://..."
    },
    "mutualFriends": [],
    "reason": "Friend of a friend"
  }
]
```

**⚠️ Lưu ý:**
- API này trả về "friends of friends"
- Nếu chưa có bạn bè, danh sách sẽ trống
- Limit 10 gợi ý

---

## 🔎 BƯỚC 15: Tìm Kiếm User

### Endpoint: Search Users

**Request Details:**
- **Method**: `GET`
- **URL**: `{{baseUrl}}/api/friends/search?keyword=test`
- **Header**: `Authorization: Bearer {{authToken}}`

**Expected Response (200 OK):**
```json
[]
```

**⚠️ Lưu ý:**
- Hiện tại API này trả về empty list
- Feature này sẽ được implement trong tương lai
- Search users có thể dùng auth-service API: `GET /api/users/search?keyword=...`

---

## 🧪 Test Kịch Bản Hoàn Chỉnh

### Kịch Bản: Quy trình kết bạn hoàn chỉnh

1. **Tạo 2 user mới** (nếu chưa có)
   - Register user1@example.com
   - Register user2@example.com

2. **Login cả 2 user**
   - Lưu token của cả 2

3. **User1 gửi lời mời đến User2**
   - POST /api/friends/request
   - Lưu requestId

4. **User2 xem lời mời**
   - GET /api/friends/requests/received
   - Xác nhận có lời mời từ User1

5. **User2 chấp nhận lời mời**
   - PUT /api/friends/requests/{requestId}/accept

6. **Cả 2 user xem danh sách bạn bè**
   - GET /api/friends
   - Xác nhận thấy nhau trong danh sách

7. **User1 chặn User2**
   - POST /api/friends/{friendId}/block

8. **User2 xem danh sách bạn bè**
   - GET /api/friends
   - Xác nhận User1 không còn trong danh sách

9. **User1 bỏ chặn User2**
   - DELETE /api/friends/{friendId}/block

10. **User2 gửi lời mời lại**
    - POST /api/friends/request
    - Xác nhận có thể gửi lại

---

## ⚠️ Các lỗi thường gặp

### 1. 401 Unauthorized
**Nguyên nhân:**
- Token không hợp lệ hoặc hết hạn
- Thiếu header Authorization

**Giải pháp:**
- Login lại để lấy token mới
- Kiểm tra header có `Bearer ` phía trước token

### 2. 409 Conflict
**Nguyên nhân:**
- Đã là bạn bè
- Lời mời đã tồn tại
- User đã bị chặn

**Giải pháp:**
- Kiểm tra trạng thái trước khi gửi
- Xóa lời mời cũ trước (nếu cần)

### 3. 403 Forbidden
**Nguyên nhân:**
- Không có quyền thực hiện hành động
- User bị chặn

**Giải pháp:**
- Chỉ chủ tài khoản mới có thể chấp nhận/hủy lời mời
- Bỏ chặn user trước khi gửi lời mời

### 4. 404 Not Found
**Nguyên nhân:**
- User ID không tồn tại
- Request ID không tồn tại

**Giải pháp:**
- Kiểm tra ID chính xác
- Dùng API `/api/users/profile` để lấy ID chính xác

### 5. 500 Internal Server Error
**Nguyên nhân:**
- Service không chạy
- Database connection error

**Giải pháp:**
- Check logs: `docker logs friend-service`
- Check database: `docker logs friend-db`
- Restart services: `docker-compose restart friend-service`

---

## 📊 Quick Reference Table

| Bước | Endpoint | Method | Auth | Description |
|-------|-----------|--------|-------|-------------|
| 0 | `/api/auth/login` | POST | ❌ | Login lấy token |
| 1 | `/api/users/profile` | GET | ✅ | Lấy user ID |
| 2 | `/api/friends/request` | POST | ✅ | Gửi lời mời |
| 3 | `/api/friends/requests/received` | GET | ✅ | Xem lời mời nhận |
| 4 | `/api/friends/requests/sent` | GET | ✅ | Xem lời mời gửi |
| 5 | `/api/friends/requests/{id}/accept` | PUT | ✅ | Chấp nhận lời mời |
| 6 | `/api/friends/requests/{id}/reject` | PUT | ✅ | Từ chối lời mời |
| 7 | `/api/friends/requests/{id}` | DELETE | ✅ | Hủy lời mời |
| 8 | `/api/friends` | GET | ✅ | Danh sách bạn bè |
| 9 | `/api/friends/{id}/status` | GET | ✅ | Trạng thái bạn bè |
| 10 | `/api/friends/{id}/block` | POST | ✅ | Chặn user |
| 11 | `/api/friends/{id}/block` | DELETE | ✅ | Bỏ chặn user |
| 12 | `/api/friends/blocked` | GET | ✅ | Danh sách đã chặn |
| 13 | `/api/friends/{id}` | DELETE | ✅ | Hủy kết bạn |
| 14 | `/api/friends/recommendations` | GET | ✅ | Gợi ý bạn |
| 15 | `/api/friends/search` | GET | ✅ | Tìm kiếm user |

---

## 🎓 Tips & Tricks

### 1. Sử dụng Postman Environment Variables
- Lưu ID, token vào variables để không phải copy-paste
- Dùng `{{variableName}}` trong request

### 2. Tạo nhiều environments
- Development: `https://api.chatify.asia`
- Local: `http://localhost:8080`
- Staging: `https://staging-api.chatify.asia`

### 3. Tạo Postman Collection với Pre-request Script
```javascript
// Tự động add token vào header
pm.request.headers.add({
    key: 'Authorization',
    value: 'Bearer ' + pm.environment.get('authToken')
});
```

### 4. Test Script trong Postman
```javascript
// Verify response status
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Verify response has data
pm.test("Response has data", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
});
```

### 5. Export Collection
- File → Export → Save collection
- Share với team hoặc import vào máy khác

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề khi test:

1. **Kiểm tra service status:**
   ```bash
   docker-compose ps friend-service
   ```

2. **Xem logs:**
   ```bash
   docker logs friend-service --tail 100
   ```

3. **Test connection trực tiếp:**
   ```bash
   curl https://api.chatify.asia/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

4. **Kiểm tra API Gateway:**
   - `docker logs api-gateway`
   - Xem có routing errors không

5. **Debug trong Postman:**
   - Tab "Console" ở góc dưới cùng
   - Xem request/response details

---

**Happy Testing! 🚀**

