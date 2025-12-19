# Quick Build & Test Guide

## 🔨 Build Commands

### Option 1: Build All Services at Once
```bash
cd d:\DoAnTotNghiep

# Build API Gateway
cd api-gateway && mvn clean package -DskipTests && cd ..

# Build Chat Service  
cd chat-service && mvn clean package -DskipTests && cd ..

# Build Notification Service
cd notification-service && mvn clean package -DskipTests && cd ..
```

### Option 2: Using Docker Compose (Recommended)
```bash
cd d:\DoAnTotNghiep

# Rebuild and restart only the modified services
docker-compose up -d --build api-gateway chat-service notification-service

# Or rebuild everything
docker-compose down
docker-compose up -d --build
```

---

## 🔍 Monitor Logs (Watch for these in order)

### 1. Gateway Log - JWT Extraction
```
🚀 GATEWAY_SENDING_NAME: John Doe (userId: abc123)
```
✅ **Good:** Shows actual name  
❌ **Bad:** Shows userId or nothing

### 2. WebSocket Connection Log - Header Capture
```
🔗 [WebSocket] Captured X-User-Name from handshake: John Doe
```
✅ **Good:** Shows the captured name  
⚠️ **Warning:** If missing, headers aren't reaching WebSocket

### 3. Message Handler Log - Processing
```
📨 [ChatController] Processing message from: John Doe (senderId: abc123)
```
✅ **Good:** Has the name  
❌ **Bad:** Shows null

### 4. Chat Service Log - Notification Prep
```
✅ [ChatMessageService] Using senderName from Gateway: John Doe
```
✅ **Good:** Using actual name  
⚠️ **Warning:** If it says "using fallback 'Người lạ'", something failed upstream

### 5. Feign Client Log - Sending Request
```
📤 [ChatMessageService] Sending 1-1 notification to xyz456 with senderName: John Doe
```
✅ **Good:** Name is being sent

### 6. Notification Controller Log - Received
```
📥 [NotificationController] Received request - userId: xyz456, senderName: John Doe
```
✅ **Good:** Name arrived at notification service

### 7. FCM Send Log - Final Result
```
>> Đã gửi Data-Message tới user xyz456 (from: John Doe): projects/...
```
✅ **Good:** Firebase was notified with correct name

---

## 🧪 Testing Steps

1. **Clear app data** (to ensure fresh WebSocket connection)
   
2. **Login** to the mobile app (this creates a new WebSocket connection with headers)

3. **Send a test message** from User A to User B

4. **Check logs** in order (see above)

5. **Verify notification** on User B's device shows User A's actual name

---

## 🐛 Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Still shows "Người lạ" | JWT doesn't have name claims | Check your Auth Service token generation |
| Gateway log missing | Service not restarted | Restart api-gateway container |
| WebSocket log missing | Interceptor not registered | Verify WebSocketConfig changes |
| Name is userId | JWT only has subject claim | Update Auth Service to include fullName/name |
| Headers not capturing | Gateway not forwarding headers to WebSocket | Check Gateway WebSocket config |

---

## 📱 Check Your JWT Token

Decode your token at https://jwt.io

**Look for these claims (in order of preference):**
1. `fullName`: "John Doe"
2. `name`: "John Doe"  
3. `username`: "johndoe"
4. `preferred_username`: "johndoe"
5. `nickname`: "johnny"
6. `sub`: "abc123" (used as last resort)

If none of these exist, you need to update your Auth Service to include them in the JWT.

---

## 🔄 Quick Restart Commands

```bash
# Just restart without rebuilding
docker-compose restart api-gateway chat-service notification-service

# Or restart everything
docker-compose restart

# View live logs
docker-compose logs -f api-gateway chat-service notification-service
```

---

## ✅ Success Criteria

- [ ] Gateway log shows actual username (not userId)
- [ ] WebSocket handshake captures the X-User-Name header
- [ ] Chat controller receives username in session
- [ ] Chat service sends username to notification service
- [ ] Notification controller receives username
- [ ] FCM sends notification with correct name
- [ ] **Mobile device shows correct username in notification (not "Người lạ")**

---

## 🚀 Ready to Test!

All code changes are complete. Please rebuild and test following the steps above.
