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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    // 1. Xử lý tin nhắn Chat
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        try {
            Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                    chatMessage.getSenderId(), chatMessage.getRecipientId(), true);
            chatRoomService.getChatRoomId(
                    chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

            if (chatIdSender.isPresent()) {
                chatMessage.setChatId(chatIdSender.get());
            }

            // Lưu tin nhắn (Bao gồm cả trường type vừa thêm)
            ChatMessage savedMsg = chatMessageService.save(chatMessage);

            // Gửi thông báo realtime cho người nhận
            messagingTemplate.convertAndSend(
                    "/topic/" + chatMessage.getRecipientId(),
                    ChatNotification.builder()
                            .id(savedMsg.getId())
                            .senderId(savedMsg.getSenderId())
                            .recipientId(savedMsg.getRecipientId())
                            .content(savedMsg.getContent())
                            .type(savedMsg.getType()) // [QUAN TRỌNG] Truyền type về cho FE
                            .build()
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 2. Xử lý sự kiện Typing
    @MessageMapping("/typing")
    public void processTyping(@Payload TypingMessage typingMessage) {
        messagingTemplate.convertAndSend(
                "/topic/" + typingMessage.getRecipientId(),
                typingMessage
        );
    }

    // 3. Xử lý khi User Online (Báo danh)
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

    // 4. Xử lý khi User Offline (Ngắt kết nối)
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headers = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String userId = (String) headers.getSessionAttributes().get("userId");

        if (userId != null) {
            System.out.println("User Disconnected: " + userId);

            userStatusService.saveUserOffline(userId);

            messagingTemplate.convertAndSend("/topic/status/" + userId,
                    Map.of(
                            "status", "OFFLINE",
                            "userId", userId,
                            "lastSeen", new java.util.Date()
                    )
            );
        }
    }

    @GetMapping("/rooms/status/{userId}")
    public ResponseEntity<UserStatus> getUserStatus(@PathVariable String userId) {
        UserStatus status = userStatusService.getUserStatus(userId);
        return ResponseEntity.ok(status);
    }

    @GetMapping("/messages/{senderId}/{recipientId}")
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping("/rooms/{userId}")
    public ResponseEntity<List<ChatRoom>> getChatRooms(@PathVariable String userId) {
        return ResponseEntity.ok(chatRoomService.getChatRooms(userId));
    }
}