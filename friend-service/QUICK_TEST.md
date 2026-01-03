# Quick Test Guide - Friend Service API

## 🚀 CÁCH 1: Test nhanh bằng **cURL** (Đơn giản nhất)

### Bước 1: Login lấy token
```bash
curl -X POST "https://api.chatify.asia/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_username",
    "password": "your_password"
  }'
```

**Copy token từ response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Bước 2: Lấy danh sách bạn bè
```bash
curl -X GET "https://api.chatify.asia/api/friends" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Bước 3: Gửi lời mời kết bạn
```bash
curl -X POST "https://api.chatify.asia/api/friends/request" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "target_user_uuid_here",
    "message": "Hi, let's be friends!"
  }'
```

### Bước 4: Xem lời mời đã nhận
```bash
curl -X GET "https://api.chatify.asia/api/friends/requests/received" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Bước 5: Chấp nhận lời mời
```bash
curl -X PUT "https://api.chatify.asia/api/friends/requests/REQUEST_ID/accept" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🌐 CÁCH 2: Test bằng **Browser** (Không cần cài gì cả!)

Tôi đã tạo trang test đơn giản tại:
```
friend-service/test.html
```

### Cách sử dụng:
1. Mở file `test.html` trong browser
2. Nhập username/password → Click **"Login"**
3. Copy token vào ô **"Token"**
4. Click vào các nút test

---

## 💻 CÁCH 3: Test bằng **PowerShell Script** (Windows)

### Chạy script test tự động:
```powershell
cd friend-service
.\test_api.ps1 -Username "your_username" -Password "your_password"
```

Script sẽ tự động:
- ✅ Login lấy token
- ✅ Lấy thông tin user
- ✅ Xem danh sách bạn bè
- ✅ Xem lời mời đã nhận/gửi
- ✅ Xem danh sách bị chặn
- ✅ Xem gợi ý bạn bè

---

## 🐧 CÁCH 4: Test bằng **Bash Script** (Linux/Mac)

### Chạy script test tự động:
```bash
cd friend-service
chmod +x test_api.sh
./test_api.sh your_username your_password
```

---

## 📊 So sánh các cách test

| Cách | Độ khó | Nhanh? | Cần cài? | Platform |
|------|---------|--------|----------|---------|
| **Browser (test.html)** | ⭐ Rất đơn giản | ⚡ Rất nhanh | ❌ Không | Tất cả |
| **cURL** | ⭐⭐ Đơn giản | ⚡ Nhanh | ❌ Không | Tất cả |
| **PowerShell Script** | ⭐⭐ Đơn giản | ⚡ Nhanh | ✅ có sẵn | Windows |
| **Bash Script** | ⭐⭐ Đơn giản | ⚡ Nhanh | ❌ Không | Linux/Mac |
| **Postman** | ⭐⭐⭐ Trung bình | 🐌 Chậm hơn | ✅ Cài | Tất cả |

---

## 🎯 Khuyến nghị

### Muốn test nhanh nhất?
→ Dùng **Browser** với file `test.html`

### Muốn test automation?
→ Dùng **PowerShell** hoặc **Bash script**

### Muốn test chi tiết từng endpoint?
→ Dùng **Postman** collection đã có sẵn

### Muốn test đơn lẻ?
→ Dùng **cURL** commands

---

## 💡 Tips

### 1. Lưu token vào biến (Linux/Mac)
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Dùng cho các lệnh sau
curl -H "Authorization: Bearer $TOKEN" ...
```

### 2. Lưu token vào biến (Windows PowerShell)
```powershell
$TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Dùng cho các lệnh sau
Invoke-RestMethod -Headers @{Authorization = "Bearer $TOKEN"} ...
```

### 3. Format JSON đẹp hơn
```bash
curl ... | jq .
```
(nếu đã cài jq)

---

## 📝 Check List

Dưới đây là checklist để test nhanh:

- [ ] Login thành công
- [ ] Lấy được user ID
- [ ] Xem danh sách bạn bè
- [ ] Gửi lời mời kết bạn
- [ ] Xem lời mời đã nhận
- [ ] Chấp nhận lời mời
- [ ] Hủy kết bạn
- [ ] Chặn user
- [ ] Xem danh sách bị chặn
- [ ] Xem gợi ý bạn bè

---

## 🎓 Ví dụ Test hoàn chỉnh

### User A gửi lời mời đến User B

**Bước 1: User A login**
```bash
curl -X POST "https://api.chatify.asia/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user_a",
    "password": "password_a"
  }'
```
→ Copy token A

**Bước 2: User A lấy ID của User B**
```bash
curl -X GET "https://api.chatify.asia/api/users/search?keyword=user_b" \
  -H "Authorization: Bearer TOKEN_A"
```
→ Copy ID của User B

**Bước 3: User A gửi lời mời**
```bash
curl -X POST "https://api.chatify.asia/api/friends/request" \
  -H "Authorization: Bearer TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "USER_B_ID",
    "message": "Hi User B!"
  }'
```
→ Copy request ID

**Bước 4: User B login**
```bash
curl -X POST "https://api.chatify.asia/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user_b",
    "password": "password_b"
  }'
```
→ Copy token B

**Bước 5: User B xem lời mời**
```bash
curl -X GET "https://api.chatify.asia/api/friends/requests/received" \
  -H "Authorization: Bearer TOKEN_B"
```

**Bước 6: User B chấp nhận lời mời**
```bash
curl -X PUT "https://api.chatify.asia/api/friends/requests/REQUEST_ID/accept" \
  -H "Authorization: Bearer TOKEN_B"
```

**Bước 7: User A xem danh sách bạn bè**
```bash
curl -X GET "https://api.chatify.asia/api/friends" \
  -H "Authorization: Bearer TOKEN_A"
```
→ Xem User B trong danh sách

---

**Chúc bạn test thành công! 🚀**

