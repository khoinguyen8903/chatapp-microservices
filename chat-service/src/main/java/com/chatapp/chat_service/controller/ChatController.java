package com.chatapp.chat_service.controller;

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

    // 1. Xử lý tin nhắn Chat (Đã cập nhật logic Nhóm)
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        try {
            // Kiểm tra xem recipientId có phải là một Chat ID của Group không
            Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(chatMessage.getRecipientId());

            if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
                // --- TRƯỜNG HỢP CHAT NHÓM ---
                ChatRoom room = groupRoom.get();
                chatMessage.setChatId(room.getChatId()); // Đảm bảo message lưu đúng chatId của nhóm

                // Lưu tin nhắn
                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                // Gửi tin nhắn cho TẤT CẢ thành viên trong nhóm (Fan-out)
                for (String memberId : room.getMemberIds()) {
                    // Không gửi lại cho chính người gửi (để tránh double tin nhắn ở FE nếu FE đã tự add)
                    // Tuy nhiên với logic FE hiện tại thì cứ gửi hết cũng được, FE tự filter hoặc replace
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId, // Gửi vào hòm thư riêng của từng thành viên
                            ChatNotification.builder()
                                    .id(savedMsg.getId())
                                    .senderId(savedMsg.getSenderId())
                                    .recipientId(room.getChatId()) // Người nhận hiển thị là Group ID
                                    .content(savedMsg.getContent())
                                    .type(savedMsg.getType())
                                    .build()
                    );
                }
            } else {
                // --- TRƯỜNG HỢP CHAT 1-1 (Logic cũ) ---
                Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                        chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

                chatRoomService.getChatRoomId(
                        chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

                if (chatIdSender.isPresent()) {
                    chatMessage.setChatId(chatIdSender.get());
                }

                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                // Gửi cho người nhận
                messagingTemplate.convertAndSend(
                        "/topic/" + chatMessage.getRecipientId(),
                        ChatNotification.builder()
                                .id(savedMsg.getId())
                                .senderId(savedMsg.getSenderId())
                                .recipientId(savedMsg.getRecipientId())
                                .content(savedMsg.getContent())
                                .type(savedMsg.getType())
                                .build()
                );
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- API TẠO NHÓM MỚI ---
    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoom> createGroup(@RequestBody Map<String, Object> payload) {
        String groupName = (String) payload.get("groupName");
        String adminId = (String) payload.get("adminId");
        List<String> memberIds = (List<String>) payload.get("memberIds");

        return ResponseEntity.ok(chatRoomService.createGroupChat(adminId, groupName, memberIds));
    }

    // 2. Xử lý sự kiện Typing (Đã nâng cấp cho Nhóm)
    @MessageMapping("/typing")
    public void processTyping(@Payload TypingMessage typingMessage) {
        // Kiểm tra xem recipientId có phải là Group không
        Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(typingMessage.getRecipientId());

        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            // --- TRƯỜNG HỢP CHAT NHÓM ---
            ChatRoom room = groupRoom.get();
            // Gửi sự kiện typing cho tất cả thành viên TRỪ người gửi
            for (String memberId : room.getMemberIds()) {
                if (!memberId.equals(typingMessage.getSenderId())) {
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId,
                            typingMessage
                    );
                }
            }
        } else {
            // --- TRƯỜNG HỢP CHAT 1-1 ---
            messagingTemplate.convertAndSend(
                    "/topic/" + typingMessage.getRecipientId(),
                    typingMessage
            );
        }
    }

    // 3. Xử lý khi User Online
    @MessageMapping("/user.addUser")
    public void addUser(@Payload String userId, SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor.getSessionAttributes() != null) {
            headerAccessor.getSessionAttributes().put("userId", userId);
        }
        userStatusService.saveUserOnline(userId);
        messagingTemplate.convertAndSend("/topic/status/" + userId,
                Map.of("status", "ONLINE", "userId", userId));
        System.out.println("User Online: " + userId);
    }

    // 4. Xử lý khi User Offline
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String userId = (String) headers.getSessionAttributes().get("userId");

        if (userId != null) {
            System.out.println("User Disconnected: " + userId);
            userStatusService.saveUserOffline(userId);
            messagingTemplate.convertAndSend("/topic/status/" + userId,
                    Map.of("status", "OFFLINE", "userId", userId, "lastSeen", new java.util.Date()));
        }
    }

    // 5. API lấy trạng thái
    @GetMapping("/rooms/status/{userId}")
    public ResponseEntity<UserStatus> getUserStatus(@PathVariable String userId) {
        return ResponseEntity.ok(userStatusService.getUserStatus(userId));
    }

    @GetMapping("/messages/{senderId}/{recipientId}")
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        // Lưu ý: Nếu recipientId là Group ID, logic findChatMessages bên service cần xử lý tìm theo ChatId
        // Hiện tại service đã có hàm findChatMessages, bạn cần đảm bảo nó xử lý được cả 2 trường hợp
        // Nếu service chưa xử lý, có thể sửa lại ở đây:
        // if (chatRoomService.findByChatId(recipientId).isPresent()) { ... return repository.findByChatId(recipientId); }

        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping("/rooms/{userId}")
    public ResponseEntity<List<ChatRoom>> getChatRooms(@PathVariable String userId) {
        return ResponseEntity.ok(chatRoomService.getChatRooms(userId));
    }
}