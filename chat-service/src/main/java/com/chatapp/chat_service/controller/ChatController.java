package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.dto.AddMembersRequest;
import com.chatapp.chat_service.dto.KickMemberRequest;
import com.chatapp.chat_service.dto.ReactionRequest;
import com.chatapp.chat_service.dto.RoleActionRequest;
import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatNotification;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.model.TypingMessage;
import com.chatapp.chat_service.model.UserStatus;
import com.chatapp.chat_service.service.ChatMessageService;
import com.chatapp.chat_service.service.ChatRoomService;
import com.chatapp.chat_service.service.UserStatusService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Controller
public class ChatController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private ChatMessageService chatMessageService;
    @Autowired private ChatRoomService chatRoomService;
    @Autowired private UserStatusService userStatusService;

    // 1. XỬ LÝ TIN NHẮN
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        try {
            // [LOGIC CHUẨN] Lấy tên từ Session (Do WebSocketConfig đã lưu vào đây)
            String senderName = "Người lạ";

            if (headerAccessor.getSessionAttributes() != null && headerAccessor.getSessionAttributes().containsKey("username")) {
                senderName = (String) headerAccessor.getSessionAttributes().get("username");
            }

            System.out.println("📨 [ChatController] Xử lý tin nhắn từ: " + senderName + " (ID: " + chatMessage.getSenderId() + ")");

            Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(chatMessage.getRecipientId());

            if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
                // --- GROUP CHAT ---
                ChatRoom room = groupRoom.get();
                chatMessage.setChatId(room.getChatId());
                ChatMessage savedMsg = chatMessageService.save(chatMessage, senderName);

                for (String memberId : room.getMemberIds()) {
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId,
                            ChatNotification.builder()
                                    .id(savedMsg.getId())
                                    .senderId(savedMsg.getSenderId())
                                    .senderName(senderName)
                                    .recipientId(room.getChatId())
                                    .chatId(room.getChatId())  // [CRITICAL] Explicit chatId for group
                                    .content(savedMsg.getContent())
                                    .fileName(savedMsg.getFileName()) // Include original filename
                                    .type(savedMsg.getType())
                                    .status(savedMsg.getStatus())
                                    .replyToId(savedMsg.getReplyToId()) // [NEW] Include reply info
                                    .messageStatus(savedMsg.getMessageStatus()) // [NEW] Include revoke status
                                    .build()
                    );
                }
            } else {
                // --- 1-1 CHAT ---
                // [FIXED] With unique ChatRoom model, only need to get chatId once
                // The method internally sorts IDs, so chatId is always the same
                Optional<String> chatId = chatRoomService.getChatRoomId(
                        chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

                if (chatId.isPresent()) {
                    chatMessage.setChatId(chatId.get());
                }

                ChatMessage savedMsg = chatMessageService.save(chatMessage, senderName);

                ChatNotification notification = ChatNotification.builder()
                        .id(savedMsg.getId())
                        .senderId(savedMsg.getSenderId())
                        .senderName(senderName)
                        .recipientId(savedMsg.getRecipientId())
                        .chatId(savedMsg.getChatId())  // [CRITICAL] Explicit chatId for 1-1
                        .content(savedMsg.getContent())
                        .fileName(savedMsg.getFileName()) // Include original filename
                        .type(savedMsg.getType())
                        .status(savedMsg.getStatus())
                        .replyToId(savedMsg.getReplyToId()) // [NEW] Include reply info
                        .messageStatus(savedMsg.getMessageStatus()) // [NEW] Include revoke status
                        .build();

                messagingTemplate.convertAndSend("/topic/" + chatMessage.getRecipientId(), notification);
                messagingTemplate.convertAndSend("/topic/" + chatMessage.getSenderId(), notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * [NEW] React to a message (toggle/update/remove) and broadcast to room topic.
     * Frontend sends: { messageId, userId, chatId, type }
     * Backend broadcasts updated ChatMessage to: /topic/chat/{chatId}
     */
    @MessageMapping("/chat.react")
    public void reactToMessage(@Payload ReactionRequest request) {
        try {
            System.out.println("❤️ [ChatController] React request received: " + request);

            if (request == null ||
                request.getMessageId() == null ||
                request.getUserId() == null ||
                request.getType() == null ||
                request.getChatId() == null) {
                System.out.println("⚠️ [ChatController] /chat.react missing fields");
                return;
            }

            ChatMessage updated = chatMessageService.reactToMessage(
                    request.getMessageId(),
                    request.getUserId(),
                    request.getType()
            );

            if (updated.getChatId() == null) {
                System.out.println("⚠️ [ChatController] /chat.react updated message has null chatId: " + updated.getId());
                return;
            }

            // Broadcast to requested room topic (and fallback to message.chatId if needed)
            String chatId = request.getChatId() != null ? request.getChatId() : updated.getChatId();
            System.out.println("✅ [ChatController] Reaction saved. Broadcasting to: /topic/chat/" + request.getChatId());
            messagingTemplate.convertAndSend("/topic/chat/" + chatId, updated);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error in reactToMessage: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * [NEW] Revoke/unsend a message (visible to everyone in the chat).
     * Frontend sends via WebSocket: { messageId, chatId }
     * Backend broadcasts updated message with messageStatus = 'REVOKED' to: /topic/chat/{chatId}
     */
    @MessageMapping("/chat.revoke")
    public void revokeMessage(@Payload Map<String, String> payload) {
        try {
            String messageId = payload.get("messageId");
            String chatId = payload.get("chatId");
            
            System.out.println("🚫 [ChatController] Revoke request - MessageId: " + messageId + ", ChatId: " + chatId);

            if (messageId == null || chatId == null) {
                System.out.println("⚠️ [ChatController] /chat.revoke missing fields");
                return;
            }

            // Update message status to REVOKED
            ChatMessage revokedMessage = chatMessageService.revokeMessage(messageId);
            
            if (revokedMessage == null) {
                System.out.println("⚠️ [ChatController] Message not found: " + messageId);
                return;
            }

            // Broadcast the revoked message to all users in the chat room
            System.out.println("✅ [ChatController] Message revoked. Broadcasting to: /topic/chat/" + chatId);
            messagingTemplate.convertAndSend("/topic/chat/" + chatId, revokedMessage);

            // Also push a lightweight MESSAGE_UPDATE event to each user's personal topic,
            // so sidebars update even if users are NOT currently subscribed to /topic/chat/{chatId}.
            try {
                Map<String, Object> updatePayload = new java.util.HashMap<>();
                updatePayload.put("eventType", "MESSAGE_UPDATE");
                updatePayload.put("id", revokedMessage.getId());
                updatePayload.put("chatId", revokedMessage.getChatId());
                updatePayload.put("senderId", revokedMessage.getSenderId());
                updatePayload.put("recipientId", revokedMessage.getRecipientId());
                updatePayload.put("content", revokedMessage.getContent());
                updatePayload.put("fileName", revokedMessage.getFileName());
                updatePayload.put("timestamp", revokedMessage.getTimestamp());
                updatePayload.put("type", revokedMessage.getType());
                updatePayload.put("status", revokedMessage.getStatus());
                updatePayload.put("reactions", revokedMessage.getReactions());
                updatePayload.put("replyToId", revokedMessage.getReplyToId());
                updatePayload.put("messageStatus", revokedMessage.getMessageStatus());

                Optional<ChatRoom> roomOpt = chatRoomService.findByChatId(chatId);
                if (roomOpt.isPresent() && roomOpt.get().getMemberIds() != null && !roomOpt.get().getMemberIds().isEmpty()) {
                    for (String memberId : roomOpt.get().getMemberIds()) {
                        if (memberId == null || memberId.isBlank()) continue;
                        messagingTemplate.convertAndSend("/topic/" + memberId, updatePayload);
                    }
                } else {
                    // Fallback: at least notify sender & recipient (1-1)
                    if (revokedMessage.getSenderId() != null) {
                        messagingTemplate.convertAndSend("/topic/" + revokedMessage.getSenderId(), updatePayload);
                    }
                    if (revokedMessage.getRecipientId() != null) {
                        messagingTemplate.convertAndSend("/topic/" + revokedMessage.getRecipientId(), updatePayload);
                    }
                }
            } catch (Exception e) {
                System.err.println("❌ [ChatController] Failed to broadcast MESSAGE_UPDATE: " + e.getMessage());
            }
            
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error in revokeMessage: " + e.getMessage());
            e.printStackTrace();
        }
    }

    // 2. KHI NGƯỜI DÙNG KẾT NỐI (User Online)
    @MessageMapping("/user.addUser")
    public void addUser(@Payload String userId, SimpMessageHeaderAccessor headerAccessor) {
        String senderName = "Người lạ";

        // Lấy tên từ Session (Đã được HandshakeInterceptor xử lý)
        if (headerAccessor.getSessionAttributes() != null && headerAccessor.getSessionAttributes().containsKey("username")) {
            senderName = (String) headerAccessor.getSessionAttributes().get("username");
        }

        // Lưu UserId vào session để dùng khi disconnect
        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("userId", userId);
        }

        userStatusService.saveUserOnline(userId);
        messagingTemplate.convertAndSend("/topic/status/" + userId,
                Map.of("status", "ONLINE", "userId", userId));

        System.out.println("✅ User Connected: " + userId + " | Name: " + senderName);
    }

    // --- CÁC PHẦN DƯỚI GIỮ NGUYÊN ---

    @MessageMapping("/status")
    public void processStatus(@Payload Map<String, String> payload) {
        try {
            String senderId = payload.get("senderId");
            String recipientId = payload.get("recipientId");
            String statusStr = payload.get("status");
            MessageStatus status = MessageStatus.valueOf(statusStr);

            System.out.println("📡 [ChatController] WebSocket /status - Sender: " + senderId + 
                               ", Recipient: " + recipientId + ", Status: " + status);

            List<ChatMessage> updatedMessages = chatMessageService.updateStatuses(senderId, recipientId, status);
            
            System.out.println("✅ [ChatController] WebSocket updated " + updatedMessages.size() + " messages");

            // Notify the sender that their messages were seen
            messagingTemplate.convertAndSend("/topic/" + senderId, Map.of(
                    "type", "STATUS_UPDATE",
                    "contactId", recipientId,
                    "status", status
            ));
            
            System.out.println("📤 [ChatController] Sent STATUS_UPDATE to /topic/" + senderId);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error in processStatus: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoom> createGroup(@RequestBody Map<String, Object> payload) {
        String groupName = (String) payload.get("groupName");
        String adminId = (String) payload.get("adminId");
        Object rawMemberIds = payload.get("memberIds");
        List<String> memberIds = new java.util.ArrayList<>();
        if (rawMemberIds instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) memberIds.add(String.valueOf(o));
            }
        }
        return ResponseEntity.ok(chatRoomService.createGroupChat(adminId, groupName, memberIds));
    }

    @MessageMapping("/typing")
    public void processTyping(@Payload TypingMessage typingMessage) {
        Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(typingMessage.getRecipientId());
        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            ChatRoom room = groupRoom.get();
            for (String memberId : room.getMemberIds()) {
                if (!memberId.equals(typingMessage.getSenderId())) {
                    messagingTemplate.convertAndSend("/topic/" + memberId, typingMessage);
                }
            }
        } else {
            messagingTemplate.convertAndSend("/topic/" + typingMessage.getRecipientId(), typingMessage);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String userId = null;
        if(headers.getSessionAttributes() != null) {
            userId = (String) headers.getSessionAttributes().get("userId");
        }

        if (userId != null) {
            System.out.println("User Disconnected: " + userId);
            userStatusService.saveUserOffline(userId);
            messagingTemplate.convertAndSend("/topic/status/" + userId,
                    Map.of("status", "OFFLINE", "userId", userId, "lastSeen", new java.util.Date()));
        }
    }

    @GetMapping("/rooms/status/{userId}")
    public ResponseEntity<UserStatus> getUserStatus(@PathVariable String userId) {
        return ResponseEntity.ok(userStatusService.getUserStatus(userId));
    }

    @GetMapping("/messages/{senderId}/{recipientId}")
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping("/rooms/{userId}")
    public ResponseEntity<List<ChatRoom>> getChatRooms(@PathVariable String userId) {
        try {
            List<ChatRoom> rooms = chatRoomService.getChatRooms(userId);
            return ResponseEntity.ok(rooms);
        } catch (Exception e) {
            // [FIXED] Log error and return empty list instead of 500 error
            System.err.println("❌ [ChatController] Error loading rooms for user " + userId + ": " + e.getMessage());
            e.printStackTrace();
            
            // Return empty list with 200 status to prevent frontend crash
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    /**
     * [NEW] HTTP REST endpoint for marking messages as read
     * More reliable than WebSocket-only approach
     * 
     * @param senderId - For 1-1 chat: partner's ID; For group: current user's ID
     * @param recipientId - For 1-1 chat: current user's ID; For group: group ID
     * @return Updated messages with SEEN status
     */
    @PostMapping("/messages/mark-read/{senderId}/{recipientId}")
    public ResponseEntity<Map<String, Object>> markMessagesAsRead(
            @PathVariable String senderId,
            @PathVariable String recipientId) {
        try {
            System.out.println("📖 [ChatController] HTTP Mark as Read - Sender: " + senderId + ", Recipient: " + recipientId);
            
            // Update message statuses in database
            List<ChatMessage> updatedMessages = chatMessageService.updateStatuses(
                    senderId, recipientId, MessageStatus.SEEN);
            
            System.out.println("✅ [ChatController] Marked " + updatedMessages.size() + " messages as SEEN");
            
            // Send WebSocket notification to the message sender(s) so they see the read status
            // For 1-1 chat: notify the partner that their messages were read
            // For group chat: notify all group members (handled by updateStatuses logic)
            messagingTemplate.convertAndSend("/topic/" + senderId, Map.of(
                    "type", "STATUS_UPDATE",
                    "contactId", recipientId,
                    "status", MessageStatus.SEEN
            ));
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "updatedCount", updatedMessages.size(),
                    "message", "Messages marked as read successfully"
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error marking messages as read: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * [NEW] Delete message for current user only (others can still see it).
     * Adds the user's ID to the message's deletedForUsers list.
     * Frontend sends: POST /messages/delete/{messageId}/{userId}
     */
    @PostMapping("/messages/delete/{messageId}/{userId}")
    public ResponseEntity<Map<String, Object>> deleteMessageForMe(
            @PathVariable String messageId,
            @PathVariable String userId) {
        try {
            System.out.println("🗑️ [ChatController] Delete for me - MessageId: " + messageId + ", UserId: " + userId);
            
            ChatMessage updatedMessage = chatMessageService.deleteMessageForUser(messageId, userId);
            
            if (updatedMessage == null) {
                return ResponseEntity.status(404).body(Map.of(
                        "success", false,
                        "error", "Message not found"
                ));
            }
            
            System.out.println("✅ [ChatController] Message deleted for user: " + userId);
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Message deleted for you successfully"
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error deleting message for user: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * [UTILITY] One-time migration endpoint to fix old messages with null status
     * This can be called once to fix all existing messages in the database
     * Should be protected in production (add authentication)
     */
    @PostMapping("/messages/fix-null-status")
    public ResponseEntity<Map<String, Object>> fixNullMessageStatus() {
        try {
            System.out.println("🔧 [ChatController] Starting migration to fix null message statuses...");
            
            List<ChatMessage> allMessages = chatMessageService.findAll();
            System.out.println("📊 [ChatController] Found " + allMessages.size() + " total messages");
            
            long nullStatusCount = allMessages.stream().filter(msg -> msg.getStatus() == null).count();
            System.out.println("⚠️ [ChatController] Messages with null status: " + nullStatusCount);
            
            if (nullStatusCount > 0) {
                List<ChatMessage> fixedMessages = chatMessageService.fixMessagesWithNullStatus();
                System.out.println("✅ [ChatController] Fixed " + fixedMessages.size() + " messages");
                
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "totalMessages", allMessages.size(),
                        "fixedCount", fixedMessages.size(),
                        "message", "Successfully fixed messages with null status"
                ));
            } else {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "totalMessages", allMessages.size(),
                        "fixedCount", 0,
                        "message", "No messages with null status found"
                ));
            }
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error fixing null status: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    // =============================================
    // MEDIA & FILES API
    // =============================================

    /**
     * Get media/files from a chat conversation.
     * @param chatId - The chat room ID or partner ID
     * @param types - Comma-separated list of types: IMAGE, VIDEO, FILE, AUDIO
     */
    @GetMapping("/messages/{chatId}/media")
    public ResponseEntity<List<ChatMessage>> getMediaMessages(
            @PathVariable String chatId,
            @RequestParam(defaultValue = "IMAGE,VIDEO") String types) {
        try {
            System.out.println("📸 [ChatController] Getting media for chatId: " + chatId + ", types: " + types);
            
            List<MessageType> messageTypes = Arrays.stream(types.split(","))
                    .map(String::trim)
                    .map(MessageType::valueOf)
                    .collect(Collectors.toList());
            
            List<ChatMessage> media = chatMessageService.findMediaByChat(chatId, messageTypes);
            
            System.out.println("✅ [ChatController] Found " + media.size() + " media items");
            return ResponseEntity.ok(media);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error getting media: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    // =============================================
    // SEARCH IN CONVERSATION API
    // =============================================

    /**
     * Search messages in a conversation.
     * @param chatId - The chat room ID or partner ID
     * @param keyword - Search keyword
     */
    @GetMapping("/messages/{chatId}/search")
    public ResponseEntity<List<ChatMessage>> searchMessages(
            @PathVariable String chatId,
            @RequestParam String keyword) {
        try {
            System.out.println("🔍 [ChatController] Searching in chatId: " + chatId + ", keyword: " + keyword);
            
            List<ChatMessage> results = chatMessageService.searchMessagesInChat(chatId, keyword);
            
            System.out.println("✅ [ChatController] Found " + results.size() + " search results");
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error searching messages: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    // =============================================
    // MUTE NOTIFICATIONS API
    // =============================================

    /**
     * Get mute status for a user in a room.
     */
    @GetMapping("/rooms/{roomId}/mute/{userId}")
    public ResponseEntity<Map<String, Object>> getMuteStatus(
            @PathVariable String roomId,
            @PathVariable String userId) {
        try {
            boolean muted = chatRoomService.isMuted(roomId, userId);
            return ResponseEntity.ok(Map.of("muted", muted));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("muted", false));
        }
    }

    /**
     * Toggle mute status for a user in a room.
     */
    @PutMapping("/rooms/{roomId}/mute")
    public ResponseEntity<Map<String, Object>> toggleMute(
            @PathVariable String roomId,
            @RequestBody Map<String, String> body) {
        try {
            String userId = body.get("userId");
            if (userId == null || userId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "userId is required"
                ));
            }

            boolean newMuteState = chatRoomService.toggleMute(roomId, userId);
            
            System.out.println("🔔 [ChatController] Mute toggled for user " + userId + 
                              " in room " + roomId + ": " + (newMuteState ? "MUTED" : "UNMUTED"));
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "muted", newMuteState
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error toggling mute: " + e.getMessage());
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    // =============================================
    // GROUP MEMBERS API
    // =============================================

    /**
     * Get group members with their user info.
     * @param groupId - The group chatId
     */
    @GetMapping("/rooms/group/{groupId}/members")
    public ResponseEntity<List<Map<String, Object>>> getGroupMembers(@PathVariable String groupId) {
        try {
            System.out.println("👥 [ChatController] Getting members for group: " + groupId);
            
            List<Map<String, Object>> members = chatRoomService.getGroupMembersWithInfo(groupId);
            
            System.out.println("✅ [ChatController] Found " + members.size() + " group members");
            return ResponseEntity.ok(members);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Error getting group members: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new java.util.ArrayList<>());
        }
    }

    // =============================================
    // GROUP ROLE MANAGEMENT APIs
    // =============================================

    /**
     * API 1: Promote/Demote Admin
     * PUT /api/rooms/{id}/role
     * Body: { targetUserId: string, action: 'PROMOTE' | 'DEMOTE' }
     * Permission: Only OWNER can perform this.
     */
    @PutMapping("/rooms/{id}/role")
    public ResponseEntity<Map<String, Object>> updateRole(
            @PathVariable("id") String roomId,
            @RequestBody RoleActionRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String currentUserId) {
        try {
            if (currentUserId == null || currentUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User ID is required in X-User-Id header"
                ));
            }

            System.out.println("👑 [ChatController] Role update request - Room: " + roomId + 
                             ", User: " + currentUserId + ", Target: " + request.getTargetUserId() + 
                             ", Action: " + request.getAction());

            ChatRoom updatedRoom = chatRoomService.promoteOrDemoteAdmin(
                    roomId, currentUserId, request.getTargetUserId(), request.getAction());

            // Broadcast WebSocket event
            broadcastRoomUpdate(roomId, updatedRoom);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Role updated successfully",
                    "room", updatedRoom
            ));
        } catch (RuntimeException e) {
            System.err.println("❌ [ChatController] Error updating role: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Internal server error"
            ));
        }
    }

    /**
     * API 2: Kick Member
     * PUT /api/rooms/{id}/kick
     * Body: { targetUserId: string }
     * Permission: OWNER can kick ADMIN and MEMBER. ADMIN can kick MEMBER only.
     */
    @PutMapping("/rooms/{id}/kick")
    public ResponseEntity<Map<String, Object>> kickMember(
            @PathVariable("id") String roomId,
            @RequestBody KickMemberRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String currentUserId) {
        try {
            if (currentUserId == null || currentUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User ID is required in X-User-Id header"
                ));
            }

            System.out.println("👢 [ChatController] Kick request - Room: " + roomId + 
                             ", User: " + currentUserId + ", Target: " + request.getTargetUserId());

            Map<String, Object> kickResult = chatRoomService.kickMember(
                    roomId, currentUserId, request.getTargetUserId());
            
            ChatRoom updatedRoom = (ChatRoom) kickResult.get("room");
            ChatMessage systemMessage = (ChatMessage) kickResult.get("systemMessage");

            // Broadcast WebSocket event with system message
            Map<String, Object> kickEvent = new java.util.HashMap<>();
            kickEvent.put("type", "MEMBER_REMOVED");
            kickEvent.put("roomId", roomId);
            kickEvent.put("kickedUserId", request.getTargetUserId());
            kickEvent.put("room", updatedRoom);
            if (systemMessage != null) {
                kickEvent.put("systemMessage", systemMessage);
            }
            
            // Broadcast to room topic
            messagingTemplate.convertAndSend("/topic/chat-room/" + roomId + "/updated", kickEvent);
            
            // Also notify all members via their personal topics
            if (updatedRoom.getMemberIds() != null) {
                for (String memberId : updatedRoom.getMemberIds()) {
                    messagingTemplate.convertAndSend("/topic/" + memberId, kickEvent);
                }
            }
            
            // Notify the kicked user (even if they're no longer in memberIds)
            messagingTemplate.convertAndSend("/topic/" + request.getTargetUserId(), kickEvent);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Member kicked successfully",
                    "room", updatedRoom,
                    "systemMessage", systemMessage != null ? systemMessage : Map.of()
            ));
        } catch (RuntimeException e) {
            System.err.println("❌ [ChatController] Error kicking member: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Internal server error"
            ));
        }
    }

    /**
     * API 3: Leave Group
     * PUT /api/rooms/{id}/leave
     * Constraint: OWNER cannot leave. They must delete the group or transfer ownership first.
     */
    @PutMapping("/rooms/{id}/leave")
    public ResponseEntity<Map<String, Object>> leaveGroup(
            @PathVariable("id") String roomId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            if (userId == null || userId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User ID is required in X-User-Id header"
                ));
            }

            System.out.println("🚪 [ChatController] Leave request - Room: " + roomId + ", User: " + userId);

            ChatRoom updatedRoom = chatRoomService.leaveGroup(roomId, userId);

            // Broadcast WebSocket event
            broadcastRoomUpdate(roomId, updatedRoom);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Left group successfully",
                    "room", updatedRoom
            ));
        } catch (RuntimeException e) {
            System.err.println("❌ [ChatController] Error leaving group: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Internal server error"
            ));
        }
    }

    /**
     * API 4: Delete Group
     * DELETE /api/rooms/{id}
     * Permission: Only OWNER can delete.
     */
    @DeleteMapping("/rooms/{id}")
    public ResponseEntity<Map<String, Object>> deleteGroup(
            @PathVariable("id") String roomId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        try {
            if (userId == null || userId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User ID is required in X-User-Id header"
                ));
            }

            System.out.println("🗑️ [ChatController] Delete group request - Room: " + roomId + ", User: " + userId);

            chatRoomService.deleteGroup(roomId, userId);

            // Broadcast WebSocket event to notify all members
            Map<String, Object> deleteEvent = new java.util.HashMap<>();
            deleteEvent.put("eventType", "ROOM_DELETED");
            deleteEvent.put("roomId", roomId);
            
            // Get room members before deletion (we need to do this before deleteGroup)
            Optional<ChatRoom> roomOpt = chatRoomService.findByChatId(roomId);
            if (roomOpt.isPresent()) {
                ChatRoom room = roomOpt.get();
                if (room.getMemberIds() != null) {
                    for (String memberId : room.getMemberIds()) {
                        messagingTemplate.convertAndSend("/topic/" + memberId, deleteEvent);
                    }
                }
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Group deleted successfully"
            ));
        } catch (RuntimeException e) {
            System.err.println("❌ [ChatController] Error deleting group: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Internal server error"
            ));
        }
    }

    /**
     * API 5: Add Members to Group
     * PUT /api/rooms/{id}/add
     * Body: { userIds: string[] }
     * Permission: Only OWNER or ADMIN can add members.
     */
    @PutMapping("/rooms/{id}/add")
    public ResponseEntity<Map<String, Object>> addMembers(
            @PathVariable("id") String roomId,
            @RequestBody AddMembersRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String currentUserId) {
        try {
            if (currentUserId == null || currentUserId.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User ID is required in X-User-Id header"
                ));
            }

            if (request.getUserIds() == null || request.getUserIds().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "error", "User IDs are required"
                ));
            }

            System.out.println("➕ [ChatController] Add members request - Room: " + roomId + 
                             ", User: " + currentUserId + ", New Members: " + request.getUserIds());

            Map<String, Object> result = chatRoomService.addMembers(
                    roomId, currentUserId, request.getUserIds());

            ChatRoom updatedRoom = (ChatRoom) result.get("room");
            ChatMessage systemMessage = (ChatMessage) result.get("systemMessage");
            @SuppressWarnings("unchecked")
            List<String> addedUserIds = (List<String>) result.get("addedUserIds");

            // Broadcast WebSocket event
            Map<String, Object> addEvent = new java.util.HashMap<>();
            addEvent.put("type", "MEMBERS_ADDED");
            addEvent.put("roomId", roomId);
            addEvent.put("room", updatedRoom);
            addEvent.put("addedUserIds", addedUserIds);
            if (systemMessage != null) {
                addEvent.put("systemMessage", systemMessage);
            }
            
            // Broadcast to room topic
            messagingTemplate.convertAndSend("/topic/chat-room/" + roomId + "/updated", addEvent);
            
            // Notify all existing members
            if (updatedRoom.getMemberIds() != null) {
                for (String memberId : updatedRoom.getMemberIds()) {
                    messagingTemplate.convertAndSend("/topic/" + memberId, addEvent);
                }
            }
            
            // Also notify new members specifically so the group appears in their sidebar
            for (String newUserId : addedUserIds) {
                Map<String, Object> newMemberEvent = new java.util.HashMap<>();
                newMemberEvent.put("type", "ROOM_ADDED");
                newMemberEvent.put("room", updatedRoom);
                messagingTemplate.convertAndSend("/topic/" + newUserId, newMemberEvent);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Members added successfully",
                    "room", updatedRoom,
                    "systemMessage", systemMessage != null ? systemMessage : Map.of(),
                    "addedUserIds", addedUserIds
            ));
        } catch (RuntimeException e) {
            System.err.println("❌ [ChatController] Error adding members: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Unexpected error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "error", "Internal server error"
            ));
        }
    }

    /**
     * Helper method to broadcast room update via WebSocket
     */
    private void broadcastRoomUpdate(String roomId, ChatRoom room) {
        try {
            // Broadcast to room-specific topic
            messagingTemplate.convertAndSend("/topic/chat-room/" + roomId + "/updated", room);
            
            // Also notify all members via their personal topics
            Map<String, Object> updateEvent = new java.util.HashMap<>();
            updateEvent.put("eventType", "ROOM_UPDATED");
            updateEvent.put("roomId", roomId);
            updateEvent.put("room", room);
            
            if (room.getMemberIds() != null) {
                for (String memberId : room.getMemberIds()) {
                    messagingTemplate.convertAndSend("/topic/" + memberId, updateEvent);
                }
            }
            
            System.out.println("📢 [ChatController] Broadcasted room update for: " + roomId);
        } catch (Exception e) {
            System.err.println("❌ [ChatController] Failed to broadcast room update: " + e.getMessage());
        }
    }
}