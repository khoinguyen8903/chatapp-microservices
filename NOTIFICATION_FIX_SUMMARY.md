# Notification Name Fix - Summary of Changes

## Problem
Notifications were showing "Người lạ" (Stranger) instead of actual usernames because the sender name was not properly propagating from the Gateway through WebSocket connections to the Notification Service.

## Root Cause
The `X-User-Name` HTTP header from the API Gateway was not being captured during the WebSocket handshake, so it was unavailable in WebSocket message handlers.

---

## Changes Made

### 1. API Gateway Service

#### File: `api-gateway/src/main/java/com/chatapp/api_gateway/util/JwtUtil.java`
**Changes:**
- Enhanced `extractUsername()` to check multiple JWT claim names: `fullName`, `name`, `username`, `preferred_username`, `nickname`
- Added fallback to `subject` if no name claims are found
- Added logging to track which claim is used

**Why:** Different JWT issuers (Firebase, OIDC, custom) use different claim names. This ensures compatibility.

#### File: `api-gateway/src/main/java/com/chatapp/api_gateway/filter/AuthenticationFilter.java`
**Changes:**
- Added logging: `System.out.println("🚀 GATEWAY_SENDING_NAME: " + username + " (userId: " + userId + ")");`
- This logs every time a request passes through with the extracted username

**Why:** Helps verify the Gateway is correctly extracting and forwarding the username.

---

### 2. Chat Service

#### File: `chat-service/src/main/java/com/chatapp/chat_service/config/WebSocketChannelInterceptor.java` (NEW)
**Changes:**
- Created new interceptor to capture HTTP headers during WebSocket CONNECT
- Stores `X-User-Name` in session attributes for use in all subsequent WebSocket messages
- Adds logging to confirm header capture

**Why:** WebSocket message handlers can't access HTTP headers directly. This interceptor captures them during the initial handshake and makes them available throughout the session.

#### File: `chat-service/src/main/java/com/chatapp/chat_service/config/WebSocketConfig.java`
**Changes:**
- Added `@Autowired WebSocketChannelInterceptor`
- Implemented `configureClientInboundChannel()` to register the interceptor

**Why:** Registers the interceptor so it can capture headers during WebSocket connections.

#### File: `chat-service/src/main/java/com/chatapp/chat_service/controller/ChatController.java`
**Changes:**
- Modified `processMessage()` to retrieve `senderName` from session attributes instead of native headers
- Added logging: `System.out.println("📨 [ChatController] Processing message from: " + senderName + " (senderId: " + chatMessage.getSenderId() + ")");`

**Why:** Session attributes are the correct way to access data captured during the WebSocket handshake.

#### File: `chat-service/src/main/java/com/chatapp/chat_service/service/ChatMessageService.java`
**Changes:**
- Enhanced logging in `handleNotification()` to show when fallback is used vs. actual name
- Added logging before sending notifications to track what data is being sent
- Logs for both group chat and 1-1 chat scenarios

**Why:** Provides visibility into whether the correct name is reaching the notification logic.

---

### 3. Notification Service

#### File: `notification-service/src/main/java/com/chatapp/notification_service/controller/NotificationController.java`
**Changes:**
- Added logging: `System.out.println("📥 [NotificationController] Received request - userId: " + userId + ", senderName: " + senderName);`

**Why:** Confirms what data the Notification Service receives from Chat Service.

---

## Data Flow (After Fix)

```
┌─────────────────┐
│   Frontend      │  Sends JWT token in Authorization header
│   (Mobile App)  │
└────────┬────────┘
         │ HTTP Request with JWT
         ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway                                                 │
│  1. JwtUtil.extractUsername() - Checks multiple JWT claims  │
│  2. Sets X-User-Name header (logged)                        │
└────────┬────────────────────────────────────────────────────┘
         │ HTTP Request with X-User-Name header
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Chat Service - WebSocket Handshake                         │
│  3. WebSocketChannelInterceptor captures X-User-Name        │
│  4. Stores it in session attributes (logged)                │
└────────┬────────────────────────────────────────────────────┘
         │ WebSocket message
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Chat Service - Message Handler                             │
│  5. ChatController.processMessage() gets name from session  │
│  6. Passes senderName to ChatMessageService (logged)        │
└────────┬────────────────────────────────────────────────────┘
         │ NotificationRequest with senderName
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Notification Service                                        │
│  7. NotificationController receives senderName (logged)     │
│  8. NotificationService sends FCM with actual name          │
└────────┬────────────────────────────────────────────────────┘
         │ Firebase Cloud Message
         ▼
┌─────────────────┐
│   Mobile Device │  Shows notification with correct username
└─────────────────┘
```

---

## Logging Points (for debugging)

1. **Gateway:** `🚀 GATEWAY_SENDING_NAME: {username} (userId: {userId})`
2. **WebSocket Handshake:** `🔗 [WebSocket] Captured X-User-Name from handshake: {userName}`
3. **Chat Controller:** `📨 [ChatController] Processing message from: {senderName} (senderId: {senderId})`
4. **Chat Service:** `✅ [ChatMessageService] Using senderName from Gateway: {senderName}`
5. **Chat Service (send):** `📤 [ChatMessageService] Sending notification to {recipientId} with senderName: {senderName}`
6. **Notification Controller:** `📥 [NotificationController] Received request - userId: {userId}, senderName: {senderName}`
7. **Notification Service:** `>> Đã gửi Data-Message tới user {recipientId} (from: {senderName}): {response}`

---

## Next Steps

1. **Rebuild Services:**
   ```bash
   # API Gateway
   cd api-gateway
   mvn clean package -DskipTests
   
   # Chat Service
   cd ../chat-service
   mvn clean package -DskipTests
   
   # Notification Service
   cd ../notification-service
   mvn clean package -DskipTests
   ```

2. **Restart Docker Containers:**
   ```bash
   docker-compose up -d --build api-gateway chat-service notification-service
   ```

3. **Test and Monitor Logs:**
   ```bash
   # Watch all logs
   docker-compose logs -f api-gateway chat-service notification-service
   
   # Or individually
   docker-compose logs -f api-gateway
   docker-compose logs -f chat-service
   docker-compose logs -f notification-service
   ```

4. **Verify the Fix:**
   - Send a message from the mobile app
   - Check logs for the 7 logging points above
   - Verify notification shows the correct username (not "Người lạ")

---

## Potential Issues & Troubleshooting

### If Still Showing "Người lạ":

1. **Check Gateway logs** - Is the username being extracted correctly?
   - Look for: `🚀 GATEWAY_SENDING_NAME:`
   - If showing userId instead of name, check your JWT token claims

2. **Check WebSocket handshake logs** - Is the header being captured?
   - Look for: `🔗 [WebSocket] Captured X-User-Name from handshake:`
   - If missing, the Gateway might not be forwarding headers to WebSocket connections

3. **Check Chat Controller logs** - Is the controller receiving the name?
   - Look for: `📨 [ChatController] Processing message from:`
   - If null, the session attributes aren't being populated

4. **Check JWT token** - What claims does it contain?
   - Decode your JWT token at jwt.io
   - Verify it has one of: fullName, name, username, preferred_username, or nickname

### If Headers Not Propagating to WebSocket:

The Gateway might need WebSocket-specific header forwarding. Check if the Gateway's WebSocket configuration includes header propagation.

---

## Files Modified

1. ✅ `api-gateway/src/main/java/com/chatapp/api_gateway/util/JwtUtil.java`
2. ✅ `api-gateway/src/main/java/com/chatapp/api_gateway/filter/AuthenticationFilter.java`
3. ✅ `chat-service/src/main/java/com/chatapp/chat_service/config/WebSocketChannelInterceptor.java` (NEW)
4. ✅ `chat-service/src/main/java/com/chatapp/chat_service/config/WebSocketConfig.java`
5. ✅ `chat-service/src/main/java/com/chatapp/chat_service/controller/ChatController.java`
6. ✅ `chat-service/src/main/java/com/chatapp/chat_service/service/ChatMessageService.java`
7. ✅ `chat-service/src/main/java/com/chatapp/chat_service/dto/NotificationRequest.java` (already correct)
8. ✅ `notification-service/src/main/java/com/chatapp/notification_service/controller/NotificationController.java`
9. ✅ `notification-service/src/main/java/com/chatapp/notification_service/service/NotificationService.java` (already correct)

---

## Status: ✅ READY FOR TESTING

All changes have been applied. Please rebuild and test.
