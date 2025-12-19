# Quick Test Guide - Unread Count Fix

## Step 1: Start the Backend Service

```bash
cd chat-service
./mvnw spring-boot:run
```

Wait for the service to start. You should see:
```
Started ChatServiceApplication in X.XXX seconds
```

## Step 2: Run the Data Migration (First Time Only)

Open a new terminal and run:

```bash
curl -X POST http://localhost:8080/api/v1/messages/fix-null-status
```

**Expected Output:**
```json
{
  "success": true,
  "totalMessages": 150,
  "fixedCount": 25,
  "message": "Successfully fixed messages with null status"
}
```

If you get `fixedCount: 0`, that's fine - it means you don't have any old messages with null status.

## Step 3: Test the Fix

### Test Case 1: Basic Unread Count
1. Open the app in Browser 1 as User A
2. Open the app in Browser 2 as User B
3. User A sends 3 messages to User B
4. **✓ Verify:** User B sees "3" unread count in the sidebar
5. User B clicks on User A's conversation
6. **✓ Verify:** Unread count changes to "0"

### Test Case 2: Persistence Test (THE IMPORTANT ONE!)
1. Continue from Test Case 1 (unread count should be 0)
2. User B presses F5 to reload the page
3. **✓ Expected:** Unread count STAYS at "0" (not jumping to 9+!)
4. Check backend logs for:
   ```
   💬 [ChatRoomService] 1-1 Chat xxx_yyy - User yyy has 0 unread messages (SENT/DELIVERED only)
   ```

### Test Case 3: Multiple Conversations
1. User A sends 2 messages to User B
2. User C sends 3 messages to User B
3. **✓ Verify:** User B sees:
   - User A: 2 unread
   - User C: 3 unread
4. User B opens conversation with User A
5. **✓ Verify:** 
   - User A: 0 unread
   - User C: 3 unread (unchanged!)
6. User B reloads the page (F5)
7. **✓ Expected:** Counts remain the same (0 and 3)

### Test Case 4: Group Chat
1. Create a group with Users A, B, C
2. User A sends 2 messages in the group
3. **✓ Verify:** 
   - User B sees 2 unread
   - User C sees 2 unread
4. User B opens the group chat
5. **✓ Verify:**
   - User B: 0 unread
   - User C: 2 unread (still!)
6. User B reloads
7. **✓ Expected:** User B still has 0 unread

## Step 4: Check Backend Logs

Look for these patterns in your backend console:

### When Loading Rooms (After Reload)
```
💬 [ChatRoomService] 1-1 Chat user1_user2 - User user2 has 0 unread messages (SENT/DELIVERED only)
```

### When Marking Messages as Read
```
📝 [ChatMessageService] updateStatuses called - Sender: user1, Recipient: user2, Status: SEEN
📊 [ChatMessageService] Status distribution - SENT: 3, DELIVERED: 0, SEEN: 15, NULL: 0
✍️ [ChatMessageService] Updating 3 messages to SEEN
✅ [ChatMessageService] Successfully saved 3 messages with status SEEN
🔍 [ChatMessageService] Verification - SEEN messages after update: 18
```

### Good Status Distribution (What You Want to See)
```
NULL: 0  ← This should be 0 after migration!
SENT: X  ← Unread messages
DELIVERED: Y  ← Unread messages
SEEN: Z  ← Read messages
```

## Troubleshooting

### Problem: Unread count still shows 9+ after reload

**Solution 1:** Run the migration again
```bash
curl -X POST http://localhost:8080/api/v1/messages/fix-null-status
```

**Solution 2:** Check for NULL status messages in MongoDB
```javascript
// In MongoDB shell or Compass
db.chat_messages.find({ status: null }).count()
```

If you find messages with null status, the migration didn't run properly.

### Problem: Messages aren't being marked as read

**Check:** Backend logs when you open a chat. You should see:
```
📖 [ChatController] HTTP Mark as Read - Sender: userX, Recipient: userY
✅ [ChatController] Marked 3 messages as SEEN
```

If you don't see this, the frontend might not be calling the mark-as-read endpoint.

### Problem: Different unread counts in different tabs

**Explanation:** This is expected if you have the same user open in multiple tabs. Each tab maintains its own state. Reload both tabs to sync.

## Expected Behavior Summary

| Action | Expected Result |
|--------|----------------|
| Receive new message | Unread count +1 |
| Open conversation | Unread count → 0 |
| Reload page (F5) | Unread count stays 0 ✅ |
| Switch to different chat | Previous chat keeps count 0 |
| Other user's unreads | Not affected by your actions |

## Success Indicators

✅ **Backend logs show "SENT/DELIVERED only" when counting**
✅ **Status distribution shows NULL: 0**
✅ **Unread count persists correctly after F5 reload**
✅ **Different conversations have independent counts**
✅ **Group chat counts work per-user**

## If Everything Works

You should now have:
- ✅ Accurate real-time unread counts
- ✅ Persistent unread counts (survive page reload)
- ✅ No false unread counts from old messages
- ✅ Independent counts per conversation
- ✅ Clear backend logging for debugging

---

## Quick Reference: API Endpoints

```bash
# Get chat rooms with unread counts
GET http://localhost:8080/api/v1/rooms/{userId}

# Mark messages as read
POST http://localhost:8080/api/v1/messages/mark-read/{senderId}/{recipientId}

# Fix old messages (one-time migration)
POST http://localhost:8080/api/v1/messages/fix-null-status
```

## Next Steps

If all tests pass:
1. ✅ The fix is working correctly
2. Consider adding a database index for better performance
3. Monitor the logs in production
4. Add the migration endpoint to your deployment script

If tests fail:
1. Check the backend logs for errors
2. Verify MongoDB connection
3. Run the migration endpoint
4. Check the UNREAD_COUNT_FIX_SUMMARY.md for detailed debugging steps
