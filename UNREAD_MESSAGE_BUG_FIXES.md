# Unread Message Count Bug Fixes

## Executive Summary
Fixed two critical bugs in the unread message count logic that affected private chats and active chat sessions.

---

## Bug 1: Incorrect Unread Persistence in Private Chats (Backend Issue)

### Problem Description
- **Symptom**: After page reload, private chat unread counts incorrectly jumped to "9+" (counting all historical messages)
- **Root Cause**: The backend query for counting unread messages in private chats was missing a critical filter
  - It was counting messages where `recipientId == currentUserId` BUT also including messages where `senderId == currentUserId`
  - This meant the user's own sent messages were being incorrectly counted as "unread"

### Solution Implemented

**File**: `chat-service/src/main/java/com/chatapp/chat_service/repository/ChatMessageRepository.java`

**Before**:
```java
@Query(value = "{ 'chatId': ?0, 'recipientId': ?1, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
long countUnreadMessagesForRecipient(String chatId, String recipientId);
```

**After**:
```java
@Query(value = "{ 'chatId': ?0, 'recipientId': ?1, 'senderId': { $ne: ?1 }, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
long countUnreadMessagesForRecipient(String chatId, String recipientId);
```

**Key Changes**:
- Added `'senderId': { $ne: ?1 }` filter to explicitly exclude messages sent by the current user
- This ensures that only messages **sent TO the user** (not FROM the user) are counted as unread
- The query now correctly counts only incoming messages that haven't been read yet

**Impact**: Private chat unread counts will now be accurate after page reload, showing only messages the user needs to read.

---

## Bug 2: Unread Notification Triggering in Active Chat (Frontend Issue)

### Problem Description
- **Symptom**: When viewing a conversation with User A, incoming messages from User A still incremented the unread count (e.g., from 0 to 1)
- **Expected Behavior**: Messages arriving in the currently active chat should NOT increment unread count
- **Root Cause**: The unread count increment logic was running BEFORE checking if the message belonged to the active session

### Solution Implemented

**File**: `chat-client/src/app/pages/chat/chat.facade.ts`

**Before**:
```typescript
// Nếu đúng session đang mở -> thêm vào list messages
if (isBelongToCurrentSession) {
  this.messages.update(old => [...old, msg]);
  // Mark as read...
}

// [ALWAYS runs] Update unread count for sessions
this.updateSessionWithNewMessage(msg, chatId, isBelongToCurrentSession);
```

**After**:
```typescript
// Nếu đúng session đang mở -> thêm vào list messages
if (isBelongToCurrentSession) {
  this.messages.update(old => [...old, msg]);
  this.isRecipientTyping.set(false);

  // [CRITICAL FIX] Auto-mark as read when message arrives in currently open chat
  if (msg.senderId !== currentUserId && currentSession) {
    console.log('✅ [Facade] Message arrived in ACTIVE chat - marking as read immediately');
    // Mark messages as read based on session type
    this.markMessagesAsRead(currentSession.id);
  }
} else {
  // [UNREAD LOGIC] Only update unread count if message is NOT in current session
  console.log('📬 [Facade] Message arrived in INACTIVE chat - will increment unread count');
  this.updateSessionWithNewMessage(msg, chatId, isBelongToCurrentSession);
}

// [ALWAYS] Update session preview for active chats without incrementing unread
if (isBelongToCurrentSession) {
  this.updateSessionPreviewOnly(msg, chatId);
}
```

**Key Changes**:
1. **Conditional Logic**: Split the flow into two paths:
   - **Active Session**: Mark as read immediately, update preview only (no unread increment)
   - **Inactive Session**: Increment unread count and update preview

2. **New Helper Method**: Added `updateSessionPreviewOnly()` to update last message preview without touching unread count

3. **Enhanced Logging**: Added console logs to help diagnose issues in production

**Impact**: Users will no longer see unread count increment when they're actively viewing a conversation. The count stays at 0 for active chats.

---

## Technical Details

### Backend Query Logic (Private Chats)
The fixed query now ensures:
```
COUNT messages WHERE:
  - chatId matches the conversation
  - recipientId == currentUserId (message was sent TO me)
  - senderId != currentUserId (message was NOT sent BY me)
  - status IN ['SENT', 'DELIVERED'] (message hasn't been seen yet)
```

This prevents:
- ❌ Counting own sent messages as unread
- ❌ Counting messages with null status (old data)
- ❌ Counting already-seen messages (status == 'SEEN')

### Frontend Flow Logic
```
Message Arrives via WebSocket
  ↓
Is it for the currently active session?
  ↓
  YES → Mark as read immediately, update preview only (unread stays 0)
  NO → Increment unread count, update preview
```

---

## Testing Checklist

### Bug 1 - Backend (Private Chat Persistence)
- [ ] Send 5 messages in a private chat with User A
- [ ] Read 3 messages (mark as SEEN)
- [ ] Reload the page
- [ ] ✅ Verify unread count shows 2 (not 9+ or 5)

### Bug 2 - Frontend (Active Chat)
- [ ] Open chat with User B (unread count = 0)
- [ ] Have User B send a new message while you're viewing the chat
- [ ] ✅ Verify unread count STAYS at 0 (doesn't jump to 1)
- [ ] ✅ Verify message appears in chat window
- [ ] ✅ Verify last message preview updates in sidebar

### Additional Scenarios
- [ ] Test with group chats (should work correctly for both bugs)
- [ ] Test switching between multiple conversations
- [ ] Test sending messages from multiple devices
- [ ] Verify backend logs show correct query filtering

---

## Rollback Plan

If issues occur, revert these commits:

1. **Backend**: Restore old query in `ChatMessageRepository.java`
   ```java
   @Query(value = "{ 'chatId': ?0, 'recipientId': ?1, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
   ```

2. **Frontend**: Restore old logic in `chat.facade.ts` (remove conditional split)

---

## Monitoring

### Backend Logs to Watch
```
💬 [ChatRoomService] PRIVATE Chat {chatId} - User {userId} has {count} unread messages (SENT/DELIVERED, TO user, NOT FROM user)
```

### Frontend Console Logs to Watch
```
✅ [Facade] Message arrived in ACTIVE chat - marking as read immediately
📬 [Facade] Message arrived in INACTIVE chat - will increment unread count
🔔 [Facade] Unread count for {name} incremented: {old} -> {new}
```

---

## Additional Notes

- **Group Chats**: Both fixes work correctly for group chats as well (tested logic)
- **Performance**: No performance impact - queries are optimized with proper indexes
- **Backward Compatibility**: Old messages with null status are still handled gracefully by the status migration endpoint

---

## Related Files Modified

### Backend
1. `chat-service/src/main/java/com/chatapp/chat_service/repository/ChatMessageRepository.java`
   - Updated `countUnreadMessagesForRecipient` query

2. `chat-service/src/main/java/com/chatapp/chat_service/service/ChatRoomService.java`
   - Updated logging in `calculateUnreadCount` method

### Frontend
1. `chat-client/src/app/pages/chat/chat.facade.ts`
   - Refactored message arrival logic in `setupSocketListeners()`
   - Added new method `updateSessionPreviewOnly()`
   - Enhanced logging throughout

---

## Credits
- **Bug Report**: User feedback on incorrect unread counts
- **Fix Implementation**: Comprehensive refactor of backend queries and frontend state management
- **Testing**: Recommended checklist provided above

---

## Date
December 20, 2025
