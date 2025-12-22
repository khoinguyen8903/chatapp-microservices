package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.dto.ReactionRequest;
import com.chatapp.chat_service.enums.MessageStatus;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;

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
}