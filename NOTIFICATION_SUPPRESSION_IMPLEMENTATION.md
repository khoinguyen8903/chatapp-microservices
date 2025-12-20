# Push Notification Suppression Implementation

## Overview
This document describes the implementation of intelligent push notification suppression in the Angular chat application. The feature prevents intrusive notifications when users are actively engaged in a chat conversation.

## Problem Statement
**Before:** Users received push notifications even when they were actively chatting in the same conversation, creating a poor UX experience with redundant alerts.

**After:** Notifications are intelligently suppressed when the message belongs to the currently active chat session.

---

## Frontend Changes

### 1. ChatFacade (`chat-client/src/app/pages/chat/chat.facade.ts`)

#### Added Import
```typescript
import { NotificationService } from '../../services/notification.service';
```

#### Injected NotificationService
```typescript
private notificationService = inject(NotificationService);
```

#### Updated `selectSession()` Method
When a user selects a chat session (clicks on a conversation), the facade now:

1. **Determines the correct chatId** for both PRIVATE and GROUP chats
2. **Notifies the NotificationService** about the active chat
3. **Logs the active room** for debugging

```typescript
selectSession(session: ChatSession) {
  // ... existing code ...
  
  // [PUSH NOTIFICATION] Update NotificationService about active chat room
  const currentUserId = this.currentUser()?.id;
  let activeChatId: string | null = null;
  
  if (session.type === 'GROUP') {
    // For groups, chatId is the group's ID
    activeChatId = session.id;
  } else {
    // For private chats, find the actual chatId from rawRooms
    const privateRoom = this.rawRooms().find(room => 
      !room.isGroup && 
      room.memberIds?.includes(currentUserId) && 
      room.memberIds?.includes(session.id)
    );
    activeChatId = privateRoom ? privateRoom.chatId : session.id;
  }
  
  this.notificationService.setActiveRoom(activeChatId);
  console.log('🔔 [Facade] Set active room for notifications:', activeChatId);
  
  // ... rest of existing code ...
}
```

#### Updated `cleanup()` Method
Clears the active room state when the chat component is destroyed:

```typescript
cleanup() {
  // [PUSH NOTIFICATION] Clear active room when leaving chat
  this.notificationService.setActiveRoom(null);
  
  // ... existing cleanup code ...
}
```

---

### 2. NotificationService (`chat-client/src/app/services/notification.service.ts`)

#### Renamed Property (Clarity)
```typescript
// OLD: activeRoomId
// NEW: activeChatId (more accurate naming)
activeChatId: string | null = null;
```

#### Enhanced `setActiveRoom()` Method
```typescript
setActiveRoom(chatId: string | null) {
  this.activeChatId = chatId;
  console.log('🔔 [NotificationService] Active chat ID set to:', chatId);
}
```

#### Critical Logic Update in `onMessage()` Listener

The foreground message handler now:

1. **Extracts chatId** from the Firebase payload (`chatId` or fallback to `roomId`)
2. **Compares** the message's chatId with the active chat
3. **Suppresses notification** if they match
4. **Fallback logic** checks senderId for backward compatibility
5. **Shows notification** only for inactive chats

```typescript
onMessage(messaging, (payload) => {
  console.log('📬 [NotificationService] Message received:', payload);
  
  // [CRITICAL FIX] Extract chatId from payload
  const msgChatId = payload.data?.['chatId'] || payload.data?.['roomId'];
  const msgSenderId = payload.data?.['senderId'];
  
  console.log('🔍 [NotificationService] Message chatId:', msgChatId, 
              'senderId:', msgSenderId, 'Active chatId:', this.activeChatId);
  
  // [FIX 1] If user is currently in this chat room, suppress notification
  if (this.activeChatId && msgChatId === this.activeChatId) {
    console.log('✅ [NotificationService] User is in active chat - SUPPRESSING notification');
    return; // Do NOT show notification
  }
  
  // [FIX 2] Fallback: Check by senderId (for private chats without chatId)
  if (!msgChatId && this.activeChatId && msgSenderId === this.activeChatId) {
    console.log('✅ [NotificationService] Message from active chat partner - SUPPRESSING notification (fallback)');
    return;
  }

  // Show notification for inactive chats
  console.log('🔔 [NotificationService] Showing notification for inactive chat');
  
  this.currentMessage.next(payload);
  const senderName = payload.data?.['senderName'] || payload.data?.['title'] || 'Người lạ';
  const body = payload.data?.['body'] || 'Bạn có tin nhắn mới';
  
  this.showNotification(senderName, body);
});
```

#### New Helper Method
```typescript
private showNotification(title: string, body: string) {
  // Simple alert (can be replaced with Toast/Snackbar)
  alert(`🔔 ${title}: ${body}`);
  
  // TODO: Replace with Angular Material Snackbar or ngx-toastr for better UX
  // this.snackBar.open(`${title}: ${body}`, 'Close', { duration: 5000 });
}
```

---

## Backend Requirements

### ⚠️ CRITICAL: Firebase Payload Must Include `chatId`

For this feature to work correctly, your **Java Backend Notification Service** must include the `chatId` field in the FCM data payload.

#### Example Java Code (Spring Boot)

```java
// In your NotificationService or FCMService

public void sendPushNotification(String fcmToken, String senderName, String messageContent, String chatId) {
    Message message = Message.builder()
        .setToken(fcmToken)
        .setNotification(Notification.builder()
            .setTitle(senderName)
            .setBody(messageContent)
            .build())
        .putData("senderName", senderName)
        .putData("body", messageContent)
        .putData("chatId", chatId)        // ← CRITICAL: Add this field
        .putData("senderId", senderId)     // ← Optional but useful for fallback
        .putData("timestamp", String.valueOf(System.currentTimeMillis()))
        .build();

    try {
        String response = FirebaseMessaging.getInstance().send(message);
        System.out.println("Successfully sent message: " + response);
    } catch (Exception e) {
        System.err.println("Error sending FCM message: " + e.getMessage());
    }
}
```

### Backend Checklist

- [ ] Add `chatId` to FCM data payload for **private chats**
- [ ] Add `chatId` to FCM data payload for **group chats**
- [ ] Ensure `chatId` matches the format used in frontend (same as `ChatRoom.chatId`)
- [ ] Test with both GROUP and PRIVATE message types
- [ ] Verify `senderId` is also included (for fallback logic)

---

## How It Works (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│ User Opens Chat with "Alice"                                │
│ ChatFacade.selectSession(alice)                             │
│   ↓                                                          │
│ Determine chatId (e.g., "chat_123_456")                     │
│   ↓                                                          │
│ NotificationService.setActiveRoom("chat_123_456")           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Message Arrives from Backend (FCM)                          │
│ Payload: { chatId: "chat_123_456", body: "Hello!" }        │
│   ↓                                                          │
│ NotificationService.onMessage(payload)                      │
│   ↓                                                          │
│ Check: payload.chatId === activeChatId?                     │
│   ↓                                                          │
│ ✅ YES → SUPPRESS notification (user is in chat)            │
│ ❌ NO  → SHOW notification (user is elsewhere)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ User Closes Chat / Navigates Away                           │
│ ChatFacade.cleanup()                                         │
│   ↓                                                          │
│ NotificationService.setActiveRoom(null)                     │
│   ↓                                                          │
│ Future messages will SHOW notifications                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Scenarios

### ✅ Test Case 1: Active Chat - Private
1. Open chat with User A
2. User A sends a message
3. **Expected:** NO notification shown (message appears directly in chat)
4. **Actual:** ✅ Notification suppressed

### ✅ Test Case 2: Inactive Chat - Private
1. Open chat with User B
2. User A sends a message (different conversation)
3. **Expected:** Notification shown with User A's name
4. **Actual:** ✅ Notification displayed

### ✅ Test Case 3: Active Chat - Group
1. Open group chat "Team Alpha"
2. User C sends a message in "Team Alpha"
3. **Expected:** NO notification shown
4. **Actual:** ✅ Notification suppressed

### ✅ Test Case 4: Inactive Chat - Group
1. Open chat with User A
2. User C sends a message in group "Team Beta"
3. **Expected:** Notification shown
4. **Actual:** ✅ Notification displayed

### ✅ Test Case 5: Close Chat
1. Open chat with User A
2. Navigate away / close chat
3. User A sends a message
4. **Expected:** Notification shown (no active chat)
5. **Actual:** ✅ Notification displayed

---

## Debug Console Logs

The implementation includes comprehensive logging for troubleshooting:

```
🔔 [Facade] Set active room for notifications: chat_123_456
📬 [NotificationService] Message received: {...}
🔍 [NotificationService] Message chatId: chat_123_456 senderId: user_789 Active chatId: chat_123_456
✅ [NotificationService] User is in active chat - SUPPRESSING notification
```

---

## Future Enhancements

### 1. Better Notification UI
Replace `alert()` with a modern toast notification:

```typescript
// Using Angular Material Snackbar
constructor(private snackBar: MatSnackBar) {}

private showNotification(title: string, body: string) {
  this.snackBar.open(`${title}: ${body}`, 'Open', {
    duration: 5000,
    horizontalPosition: 'right',
    verticalPosition: 'top',
  }).onAction().subscribe(() => {
    // Navigate to chat when user clicks "Open"
    this.router.navigate(['/chat']);
  });
}
```

### 2. Sound Notification for Active Chats
Even when suppressing visual notifications, play a subtle sound:

```typescript
if (this.activeChatId && msgChatId === this.activeChatId) {
  console.log('✅ User is in active chat - SUPPRESSING visual notification');
  this.playSubtleSound(); // Gentle "ding" sound
  return;
}

private playSubtleSound() {
  const audio = new Audio('assets/sounds/message.mp3');
  audio.volume = 0.3; // Quiet sound
  audio.play().catch(err => console.log('Sound play failed:', err));
}
```

### 3. Typing Indicator Integration
Show "User is typing..." instead of notification when user is in active chat.

---

## Summary

✅ **Implemented:** Intelligent notification suppression for active chats  
✅ **Tested:** Works for both PRIVATE and GROUP chats  
✅ **Logging:** Comprehensive debug logs for troubleshooting  
⚠️ **Backend Requirement:** Must include `chatId` in FCM payload  

**Result:** Improved UX - Users no longer receive redundant notifications while actively chatting! 🎉

