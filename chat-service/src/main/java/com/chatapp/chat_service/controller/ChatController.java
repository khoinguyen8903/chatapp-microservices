package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.enums.MessageStatus; // [MỚI] Import Enum
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

    // 1. Chat Message Processing (Updated)
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        try {
            Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(chatMessage.getRecipientId());

            if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
                // --- GROUP CHAT ---
                ChatRoom room = groupRoom.get();
                chatMessage.setChatId(room.getChatId());
                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                for (String memberId : room.getMemberIds()) {
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId,
                            ChatNotification.builder()
                                    .id(savedMsg.getId())
                                    .senderId(savedMsg.getSenderId())
                                    .recipientId(room.getChatId())
                                    .content(savedMsg.getContent())
                                    .type(savedMsg.getType())
                                    .status(savedMsg.getStatus()) // [MỚI] Kèm status SENT
                                    .build()
                    );
                }
            } else {
                // --- 1-1 CHAT ---
                Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                        chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

                chatRoomService.getChatRoomId(
                        chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

                if (chatIdSender.isPresent()) {
                    chatMessage.setChatId(chatIdSender.get());
                }

                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                ChatNotification notification = ChatNotification.builder()
                        .id(savedMsg.getId())
                        .senderId(savedMsg.getSenderId())
                        .recipientId(savedMsg.getRecipientId())
                        .content(savedMsg.getContent())
                        .type(savedMsg.getType())
                        .status(savedMsg.getStatus()) // [MỚI] Kèm status SENT
                        .build();

                // Gửi cho người nhận
                messagingTemplate.convertAndSend("/topic/" + chatMessage.getRecipientId(), notification);
                // Gửi lại cho người gửi (để hiện tin nhắn vừa gửi)
                messagingTemplate.convertAndSend("/topic/" + chatMessage.getSenderId(), notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- [MỚI] XỬ LÝ CẬP NHẬT TRẠNG THÁI (SEEN/DELIVERED) ---
    @MessageMapping("/status")
    public void processStatus(@Payload Map<String, String> payload) {
        try {
            // Frontend gửi lên: { senderId: "A", recipientId: "B", status: "SEEN" }
            // Nghĩa là: B đang báo là "Tôi đã đọc tin nhắn của A"
            String senderId = payload.get("senderId");    // Người gửi tin nhắn gốc
            String recipientId = payload.get("recipientId"); // Người đang đọc (Mình)
            String statusStr = payload.get("status");

            MessageStatus status = MessageStatus.valueOf(statusStr);

            // 1. Update trong Database
            chatMessageService.updateStatuses(senderId, recipientId, status);

            // 2. Báo cho Người gửi tin nhắn (A) biết là B đã đọc rồi
            // A sẽ nghe ở topic của chính A, nhận được tin báo update
            messagingTemplate.convertAndSend("/topic/" + senderId, Map.of(
                    "type", "STATUS_UPDATE",
                    "contactId", recipientId, // Tin nhắn của ai gửi cho A đã được đọc? (Là B đọc)
                    "status", status
            ));

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- CÁC PHẦN DƯỚI GIỮ NGUYÊN ---

    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoom> createGroup(@RequestBody Map<String, Object> payload) {
        String groupName = (String) payload.get("groupName");
        String adminId = (String) payload.get("adminId");
        List<String> memberIds = (List<String>) payload.get("memberIds");
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
        return ResponseEntity.ok(chatRoomService.getChatRooms(userId));
    }
}