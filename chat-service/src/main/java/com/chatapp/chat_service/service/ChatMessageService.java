package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.NotificationClient;
import com.chatapp.chat_service.client.UserClient;
import com.chatapp.chat_service.dto.NotificationRequest;
import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class ChatMessageService {

    @Autowired private ChatMessageRepository repository;
    @Autowired private ChatRoomService chatRoomService;
    @Autowired private NotificationClient notificationClient;
    @Autowired
    private UserClient userClient;

    public ChatMessage save(ChatMessage chatMessage, String senderName) {
        // [CRITICAL] Never persist client-side temporary IDs like "temp_..."
        // Mongo will use any provided @Id value as the document _id.
        if (chatMessage.getId() != null && chatMessage.getId().startsWith("temp_")) {
            System.out.println("⚠️ [ChatMessageService] Clearing temporary client id before save: " + chatMessage.getId());
            chatMessage.setId(null);
        }

        // 1. Logic tạo Chat ID nếu chưa có
        if (chatMessage.getChatId() == null || chatMessage.getChatId().isEmpty()) {
            var chatId = chatRoomService
                    .getChatRoomId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true)
                    .orElseThrow();
            chatMessage.setChatId(chatId);
        }

        // [FIX] Ensure message has a valid status before saving
        if (chatMessage.getStatus() == null) {
            chatMessage.setStatus(MessageStatus.SENT);
            System.out.println("⚠️ [ChatMessageService] Message had null status, set to SENT");
        }

        // 2. Lưu tin nhắn
        ChatMessage savedMessage = repository.save(chatMessage);

        // 3. [NEW] Update ChatRoom with last message preview
        updateChatRoomLastMessage(savedMessage);

        // 4. Gửi thông báo bất đồng bộ (Async)
        CompletableFuture.runAsync(() -> {
            try {
                handleNotification(savedMessage, senderName);
            } catch (Exception e) {
                System.err.println(">> Lỗi gửi thông báo: " + e.getMessage());
                e.printStackTrace();
            }
        });

        return savedMessage;
    }

    // [NEW] Update ChatRoom entry with last message information
    // Now uses the UNIQUE ChatRoom model - single room for both 1-1 and group chats
    private void updateChatRoomLastMessage(ChatMessage message) {
        String lastMessagePreview = generateMessagePreview(message);
        
        // [FIXED] Use new 3-parameter method that works with unique ChatRoom model
        // This works for BOTH 1-1 and group chats since each chatId is unique
        chatRoomService.updateChatRoomLastMessage(
            message.getChatId(), 
            lastMessagePreview, 
            message.getTimestamp()
        );
    }

    // [NEW] Generate message preview based on type
    private String generateMessagePreview(ChatMessage message) {
        // If message is revoked, always show revoked preview
        if ("REVOKED".equals(message.getMessageStatus())) {
            return "🚫 Tin nhắn đã bị thu hồi";
        }

        MessageType type = message.getType();
        
        if (type == MessageType.TEXT) {
            return message.getContent();
        } else if (type == MessageType.IMAGE) {
            return "📷 Image";
        } else if (type == MessageType.VIDEO) {
            return "🎥 Video";
        } else if (type == MessageType.FILE) {
            // Use original filename if available, otherwise just show "File"
            String fileName = message.getFileName();
            return "📎 " + (fileName != null && !fileName.isEmpty() ? fileName : "File");
        }
        
        return message.getContent();
    }

    private void handleNotification(ChatMessage message, String senderName) {
        // A. [UPDATED] Use actual senderName from Gateway header (passed from controller)
        // Only fallback to "Người lạ" (Stranger) if senderName is null or empty
        if (senderName == null || senderName.trim().isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] senderName is null/empty, using fallback 'Người lạ'");
            senderName = "Người lạ";
        } else {
            System.out.println("✅ [ChatMessageService] Using senderName from Gateway: " + senderName);
        }

        // B. [FIX URL] Xử lý nội dung thông báo gọn gàng
        String notificationBody = "Bạn có tin nhắn mới";
        MessageType type = message.getType();

        if (type == MessageType.TEXT) {
            notificationBody = message.getContent();
            if (notificationBody != null && notificationBody.length() > 50) {
                notificationBody = notificationBody.substring(0, 47) + "...";
            }
        } else if (type == MessageType.IMAGE) {
            notificationBody = "📷 Đã gửi một ảnh";
        } else if (type == MessageType.VIDEO) {
            notificationBody = "🎥 Đã gửi một video";
        } else if (type == MessageType.FILE) {
            notificationBody = "📎 Đã gửi một tập tin";
        }

        // C. Gửi thông báo
        Optional<ChatRoom> chatRoomOpt = chatRoomService.findByChatId(message.getRecipientId());

        if (chatRoomOpt.isPresent() && chatRoomOpt.get().isGroup()) {
            // Chat Nhóm
            ChatRoom group = chatRoomOpt.get();
            for (String memberId : group.getMemberIds()) {
                if (!memberId.equals(message.getSenderId())) {
                    // [MUTE CHECK] Check if user has muted this chat
                    if (chatRoomService.shouldSuppressNotification(message.getChatId(), memberId)) {
                        System.out.println("🔕 [ChatMessageService] Skipping notification for muted user: " + memberId);
                        continue;
                    }
                    
                    NotificationRequest notiReq = new NotificationRequest(
                            memberId,
                            senderName, // Username người gửi
                            notificationBody,
                            message.getChatId()
                    );
                    System.out.println("📤 [ChatMessageService] Sending notification to group member " + memberId + " with senderName: " + senderName);
                    notificationClient.sendNotification(notiReq);
                }
            }
        } else {
            // Chat 1-1
            // [MUTE CHECK] Check if recipient has muted this chat
            if (chatRoomService.shouldSuppressNotification(message.getChatId(), message.getRecipientId())) {
                System.out.println("🔕 [ChatMessageService] Skipping notification for muted user: " + message.getRecipientId());
                return;
            }
            
            NotificationRequest notiReq = new NotificationRequest(
                    message.getRecipientId(),
                    senderName, // Username người gửi
                    notificationBody,
                    message.getChatId()
            );
            System.out.println("📤 [ChatMessageService] Sending 1-1 notification to " + message.getRecipientId() + " with senderName: " + senderName);
            notificationClient.sendNotification(notiReq);
        }
    }

    // --- CÁC HÀM KHÁC GIỮ NGUYÊN ---

    public List<ChatMessage> findChatMessages(String senderId, String recipientId) {
        var groupRoom = chatRoomService.findByChatId(recipientId);
        List<ChatMessage> messages;

        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            messages = repository.findByChatId(recipientId);
            // [NEW] Enrich group messages with sender names
            enrichMessagesWithSenderNames(messages);
        } else {
            var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);
            messages = chatId.map(repository::findByChatId).orElse(new ArrayList<>());
        }

        // [FIX] Ensure all messages have a valid status (fix old messages with null status)
        boolean hasNullStatus = messages.stream().anyMatch(msg -> msg.getStatus() == null);
        if (hasNullStatus) {
            System.out.println("⚠️ [ChatMessageService] Found messages with null status, fixing...");
            List<ChatMessage> fixedMessages = messages.stream()
                .peek(msg -> {
                    if (msg.getStatus() == null) {
                        // Default old messages to SEEN to avoid false unread counts
                        msg.setStatus(MessageStatus.SEEN);
                        System.out.println("  🔧 Fixed message ID: " + msg.getId() + " - set status to SEEN");
                    }
                })
                .collect(Collectors.toList());
            repository.saveAll(fixedMessages);
            System.out.println("✅ [ChatMessageService] Fixed all messages with null status");
            messages = fixedMessages;
        }

        // [NEW] Filter out messages deleted by the current user (senderId is the requester here)
        messages = messages.stream()
                .filter(msg -> msg.getDeletedForUsers() == null || !msg.getDeletedForUsers().contains(senderId))
                .collect(Collectors.toList());

        return messages;
    }

    /**
     * [NEW] Enrich messages with sender names by fetching from UserClient
     * This ensures all messages have correct senderName, not just those sent via WebSocket
     */
    private void enrichMessagesWithSenderNames(List<ChatMessage> messages) {
        for (ChatMessage msg : messages) {
            if (msg.getSenderId() != null && msg.getSenderName() == null) {
                try {
                    var userDTO = userClient.getUserById(msg.getSenderId());
                    if (userDTO != null && userDTO.getUsername() != null) {
                        msg.setSenderName(userDTO.getUsername());
                    } else {
                        // Fallback if user service unavailable
                        msg.setSenderName("Member");
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ [ChatMessageService] Failed to fetch sender name for " + msg.getSenderId() + ": " + e.getMessage());
                    msg.setSenderName("Member");
                }
            }
        }
    }

    public ChatMessage findById(String id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("Not found"));
    }

    /**
     * [NEW] Revoke/unsend a message (everyone sees it as revoked).
     * Sets messageStatus to 'REVOKED' without deleting the DB record.
     */
    public ChatMessage revokeMessage(String messageId) {
        Optional<ChatMessage> messageOpt = repository.findById(messageId);
        
        if (messageOpt.isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] Message not found: " + messageId);
            return null;
        }
        
        ChatMessage message = messageOpt.get();
        message.setMessageStatus("REVOKED");
        
        System.out.println("🚫 [ChatMessageService] Revoking message: " + messageId);
        ChatMessage saved = repository.save(message);

        // Update sidebar preview only if this message is the latest for this chat
        try {
            chatRoomService.findByChatId(saved.getChatId()).ifPresent(room -> {
                Date lastTs = room.getLastMessageTimestamp();
                Date msgTs = saved.getTimestamp();
                if (lastTs != null && msgTs != null && lastTs.after(msgTs)) {
                    // A newer message exists; don't overwrite last preview
                    return;
                }
                updateChatRoomLastMessage(saved);
            });
        } catch (Exception e) {
            System.err.println("❌ [ChatMessageService] Failed to update lastMessage on revoke: " + e.getMessage());
        }

        return saved;
    }

    /**
     * [NEW] Delete a message for a specific user only (local delete).
     * Adds userId to the deletedForUsers list. Other users can still see the message.
     */
    public ChatMessage deleteMessageForUser(String messageId, String userId) {
        Optional<ChatMessage> messageOpt = repository.findById(messageId);
        
        if (messageOpt.isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] Message not found: " + messageId);
            return null;
        }
        
        ChatMessage message = messageOpt.get();
        
        if (message.getDeletedForUsers() == null) {
            message.setDeletedForUsers(new ArrayList<>());
        }
        
        // Only add if not already in the list
        if (!message.getDeletedForUsers().contains(userId)) {
            message.getDeletedForUsers().add(userId);
            System.out.println("🗑️ [ChatMessageService] Deleting message " + messageId + " for user: " + userId);
            return repository.save(message);
        }
        
        System.out.println("ℹ️ [ChatMessageService] Message already deleted for user: " + userId);
        return message;
    }

    /**
     * [NEW] Toggle / update a user's reaction for a message.
     * Rules:
     * - If user reacted with same emoji again -> remove reaction (toggle off)
     * - If user reacted with different emoji -> update to new emoji
     * - If user never reacted -> add new reaction
     */
    public ChatMessage reactToMessage(String messageId, String userId, String type) {
        ChatMessage message = findById(messageId);

        if (message.getReactions() == null) {
            message.setReactions(new ArrayList<>());
        }

        Optional<ChatMessage.Reaction> existingOpt = message.getReactions().stream()
                .filter(r -> r != null && userId != null && userId.equals(r.getUserId()))
                .findFirst();

        if (existingOpt.isPresent()) {
            ChatMessage.Reaction existing = existingOpt.get();

            // Toggle off if same reaction
            if (existing.getType() != null && existing.getType().equals(type)) {
                message.getReactions().remove(existing);
            } else {
                // Update to new emoji
                existing.setType(type);
            }
        } else {
            message.getReactions().add(new ChatMessage.Reaction(userId, type));
        }

        return repository.save(message);
    }

    public void updateStatus(String id, MessageStatus status) {
        repository.findById(id).ifPresent(message -> {
            message.setStatus(status);
            repository.save(message);
        });
    }

    /**
     * [UTILITY] Get all messages (for migration purposes)
     */
    public List<ChatMessage> findAll() {
        return repository.findAll();
    }

    /**
     * [UTILITY] Fix all messages with null status by setting them to SEEN
     * This prevents old messages from being incorrectly counted as unread
     */
    public List<ChatMessage> fixMessagesWithNullStatus() {
        System.out.println("🔧 [ChatMessageService] Fixing messages with null status...");
        
        List<ChatMessage> allMessages = repository.findAll();
        List<ChatMessage> messagesToFix = allMessages.stream()
            .filter(msg -> msg.getStatus() == null)
            .peek(msg -> {
                // Set old messages to SEEN to avoid false unread counts
                msg.setStatus(MessageStatus.SEEN);
                System.out.println("  🔄 Fixed message ID: " + msg.getId() + " - set status to SEEN");
            })
            .collect(Collectors.toList());
        
        if (!messagesToFix.isEmpty()) {
            repository.saveAll(messagesToFix);
            System.out.println("✅ [ChatMessageService] Fixed " + messagesToFix.size() + " messages");
        }
        
        return messagesToFix;
    }

    /**
     * [CRITICAL] Validate if a message status can transition to a new status
     * Message status must follow the state machine: SENT -> DELIVERED -> SEEN
     * NEVER allow backward transitions (e.g., SEEN -> DELIVERED)
     * 
     * @param currentStatus The current status of the message
     * @param targetStatus The desired new status
     * @return true if transition is allowed, false otherwise
     */
    private boolean canTransitionTo(MessageStatus currentStatus, MessageStatus targetStatus) {
        // If current status is null, allow any transition (for migration of old data)
        if (currentStatus == null) {
            System.out.println("⚠️ [ChatMessageService] Message has null status, allowing transition to " + targetStatus);
            return true;
        }
        
        // If already at target status, no update needed
        if (currentStatus == targetStatus) {
            return false;
        }
        
        // Define valid state transitions based on message lifecycle
        // SENT (0) -> DELIVERED (1) -> SEEN (2)
        int currentLevel = getStatusLevel(currentStatus);
        int targetLevel = getStatusLevel(targetStatus);
        
        // Only allow forward transitions (moving to a higher level)
        boolean canTransition = targetLevel > currentLevel;
        
        if (!canTransition) {
            System.out.println("🚫 [ChatMessageService] BLOCKED backward transition: " + 
                               currentStatus + " -> " + targetStatus + " (not allowed)");
        }
        
        return canTransition;
    }
    
    /**
     * Get the numeric level of a message status for comparison
     * SENT = 0, DELIVERED = 1, SEEN = 2
     */
    private int getStatusLevel(MessageStatus status) {
        switch (status) {
            case SENT: return 0;
            case DELIVERED: return 1;
            case SEEN: return 2;
            default: return -1; // Unknown status
        }
    }

    public List<ChatMessage> updateStatuses(String senderId, String recipientId, MessageStatus status) {
        System.out.println("📝 [ChatMessageService] updateStatuses called - Sender: " + senderId + 
                           ", Recipient: " + recipientId + ", Status: " + status);
        
        // Check if recipientId is a group chatId
        Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(recipientId);
        
        String chatId;
        boolean isGroup = false;
        
        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            // For GROUP chat: recipientId is the chatId
            chatId = recipientId;
            isGroup = true;
            System.out.println("📊 [ChatMessageService] GROUP chat detected - ChatId: " + chatId);
        } else {
            // For 1-1 chat: get chatId from senderId and recipientId
            var chatIdOpt = chatRoomService.getChatRoomId(senderId, recipientId, false);
            if (chatIdOpt.isEmpty()) {
                System.out.println("⚠️ [ChatMessageService] ChatId not found for Sender: " + senderId + 
                                   ", Recipient: " + recipientId);
                return new ArrayList<>();
            }
            chatId = chatIdOpt.get();
            System.out.println("👤 [ChatMessageService] 1-1 chat detected - ChatId: " + chatId);
        }

        List<ChatMessage> messages = repository.findByChatId(chatId);
        System.out.println("📨 [ChatMessageService] Found " + messages.size() + " total messages in chat");
        
        // [DEBUG] Log status distribution before update
        long sentCount = messages.stream().filter(m -> m.getStatus() == MessageStatus.SENT).count();
        long deliveredCount = messages.stream().filter(m -> m.getStatus() == MessageStatus.DELIVERED).count();
        long seenCount = messages.stream().filter(m -> m.getStatus() == MessageStatus.SEEN).count();
        long nullCount = messages.stream().filter(m -> m.getStatus() == null).count();
        System.out.println("📊 [ChatMessageService] Status distribution - SENT: " + sentCount + 
                           ", DELIVERED: " + deliveredCount + ", SEEN: " + seenCount + ", NULL: " + nullCount);
        
        List<ChatMessage> messagesToUpdate;
        
        if (isGroup) {
            // For GROUP: Mark all messages NOT sent by the current user (senderId) with the new status
            messagesToUpdate = messages.stream()
                    .filter(msg -> !msg.getSenderId().equals(senderId))
                    .filter(msg -> canTransitionTo(msg.getStatus(), status)) // [CRITICAL FIX] Prevent backward transitions
                    .peek(msg -> {
                        System.out.println("  🔄 Updating message ID: " + msg.getId() + " from " + msg.getStatus() + " to " + status);
                        msg.setStatus(status);
                    })
                    .collect(Collectors.toList());
            System.out.println("👥 [ChatMessageService] GROUP: Marking messages NOT from " + senderId);
        } else {
            // For 1-1: Mark messages sent by the other person (senderId in payload) with the new status
            messagesToUpdate = messages.stream()
                    .filter(msg -> msg.getSenderId().equals(senderId))
                    .filter(msg -> canTransitionTo(msg.getStatus(), status)) // [CRITICAL FIX] Prevent backward transitions
                    .peek(msg -> {
                        System.out.println("  🔄 Updating message ID: " + msg.getId() + " from " + msg.getStatus() + " to " + status);
                        msg.setStatus(status);
                    })
                    .collect(Collectors.toList());
            System.out.println("💬 [ChatMessageService] 1-1: Marking messages FROM " + senderId);
        }

        System.out.println("✍️ [ChatMessageService] Updating " + messagesToUpdate.size() + " messages to " + status);
        
        if (!messagesToUpdate.isEmpty()) {
            // Save all updated messages to database
            List<ChatMessage> savedMessages = repository.saveAll(messagesToUpdate);
            System.out.println("✅ [ChatMessageService] Successfully saved " + savedMessages.size() + 
                               " messages with status " + status);
            
            // [VERIFICATION] Re-query to verify persistence
            List<ChatMessage> verifyMessages = repository.findByChatId(chatId);
            long verifySeenCount = verifyMessages.stream().filter(m -> m.getStatus() == MessageStatus.SEEN).count();
            System.out.println("🔍 [ChatMessageService] Verification - SEEN messages after update: " + verifySeenCount);
            
            return savedMessages;
        } else {
            System.out.println("ℹ️ [ChatMessageService] No messages to update (all already " + status + ")");
        }
        
        return messagesToUpdate;
    }

    /**
     * [NEW] Update read receipts for group chat messages
     * When a user views a message, add their userId to the readBy list
     * This enables showing avatars of who has seen each message (like Messenger)
     */
    public ChatMessage markMessageAsSeenByUser(String messageId, String userId) {
        Optional<ChatMessage> messageOpt = repository.findById(messageId);

        if (messageOpt.isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] Message not found: " + messageId);
            return null;
        }

        ChatMessage message = messageOpt.get();

        // Initialize readBy list if null
        if (message.getReadBy() == null) {
            message.setReadBy(new ArrayList<>());
        }

        // Add user to readBy if not already there
        if (!message.getReadBy().contains(userId)) {
            message.getReadBy().add(userId);
            System.out.println("✅ [ChatMessageService] User " + userId + " marked message " + messageId + " as seen");

            // Also update status to SEEN
            if (message.getStatus() == null || message.getStatus() == MessageStatus.SENT || message.getStatus() == MessageStatus.DELIVERED) {
                message.setStatus(MessageStatus.SEEN);
            }

            ChatMessage saved = repository.save(message);
            return saved;
        }

        System.out.println("ℹ️ [ChatMessageService] User " + userId + " already marked message " + messageId + " as seen");
        return message;
    }

    // =============================================
    // MEDIA & FILES METHODS
    // =============================================

    /**
     * Find media messages (images, videos, files) in a chat.
     * Works for both group chats (chatId) and private chats (partnerId).
     */
    public List<ChatMessage> findMediaByChat(String chatIdOrPartnerId, List<MessageType> types) {
        Sort sort = Sort.by(Sort.Direction.DESC, "timestamp");
        
        // First try to find by exact chatId (works for group chats)
        Optional<ChatRoom> roomOpt = chatRoomService.findByChatId(chatIdOrPartnerId);
        
        if (roomOpt.isPresent()) {
            // Group chat or room found directly by chatId
            return repository.findByChatIdAndTypeIn(chatIdOrPartnerId, types, sort);
        }
        
        // For private chats, search by participant ID
        List<ChatMessage> results = repository.findByParticipantAndTypeIn(chatIdOrPartnerId, types, sort);
        
        // Limit results to avoid memory issues
        if (results.size() > 100) {
            return results.subList(0, 100);
        }
        
        return results;
    }

    // =============================================
    // SEARCH IN CONVERSATION METHODS
    // =============================================

    /**
     * Search messages by keyword in a chat conversation.
     * Only searches TEXT messages.
     */
    public List<ChatMessage> searchMessagesInChat(String chatIdOrPartnerId, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return new ArrayList<>();
        }
        
        Sort sort = Sort.by(Sort.Direction.DESC, "timestamp");
        
        // Escape special regex characters in keyword
        String escapedKeyword = keyword.replaceAll("([\\[\\]\\\\^$.|?*+(){}])", "\\\\$1");
        
        List<ChatMessage> results = repository.searchByContentInChat(chatIdOrPartnerId, escapedKeyword, sort);
        
        // Limit results
        if (results.size() > 50) {
            return results.subList(0, 50);
        }
        
        return results;
    }

    /**
     * Find messages around a specific message for search navigation.
     * Returns messages before and after the target message.
     */
    public List<ChatMessage> findMessagesAround(String chatId, String messageId, int before, int after) {
        // Find the target message first
        Optional<ChatMessage> targetOpt = repository.findById(messageId);
        if (targetOpt.isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] Target message not found: " + messageId);
            return new ArrayList<>();
        }

        ChatMessage target = targetOpt.get();
        Date targetTimestamp = target.getTimestamp();

        // Find messages before target (older messages)
        List<ChatMessage> beforeMessages = repository.findByChatIdAndTimestampBeforeOrderByTimestampDesc(
            chatId, targetTimestamp
        );

        // Filter out the target message from before list and limit
        beforeMessages = beforeMessages.stream()
            .filter(m -> !m.getId().equals(messageId))
            .limit(before)
            .collect(Collectors.toList());

        // Find messages after target (newer messages)
        List<ChatMessage> afterMessages = repository.findByChatIdAndTimestampAfterOrderByTimestampAsc(
            chatId, targetTimestamp
        );

        // Filter out the target message from after list and limit
        afterMessages = afterMessages.stream()
            .filter(m -> !m.getId().equals(messageId))
            .limit(after)
            .collect(Collectors.toList());

        // Combine: messages before (in reverse chronological) + target + messages after
        List<ChatMessage> result = new ArrayList<>();

        // Add messages before (need to reverse to get chronological order)
        for (int i = beforeMessages.size() - 1; i >= 0; i--) {
            result.add(beforeMessages.get(i));
        }

        // Add target message
        result.add(target);

        // Add messages after
        result.addAll(afterMessages);

        // Enrich group messages with sender names
        Optional<ChatRoom> roomOpt = chatRoomService.findByChatId(chatId);
        if (roomOpt.isPresent() && roomOpt.get().isGroup()) {
            enrichMessagesWithSenderNames(result);
        }

        System.out.println("✅ [ChatMessageService] Found " + result.size() + " messages around target");
        return result;
    }
}