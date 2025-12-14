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

    // 1. Chat Message Processing (Updated for Groups & 1-1 Fix)
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        try {
            // Check if recipientId is a Group Chat ID
            Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(chatMessage.getRecipientId());

            if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
                // --- GROUP CHAT CASE ---
                ChatRoom room = groupRoom.get();
                chatMessage.setChatId(room.getChatId()); // Ensure message saves with group chatId

                // Save message
                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                // Fan-out: Send to ALL members (including sender)
                for (String memberId : room.getMemberIds()) {
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId, // Send to each member's personal queue
                            ChatNotification.builder()
                                    .id(savedMsg.getId())
                                    .senderId(savedMsg.getSenderId())
                                    .recipientId(room.getChatId()) // Recipient shows as Group ID
                                    .content(savedMsg.getContent())
                                    .type(savedMsg.getType())
                                    .build()
                    );
                }
            } else {
                // --- 1-1 CHAT CASE (Fixed) ---
                Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                        chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

                chatRoomService.getChatRoomId(
                        chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

                if (chatIdSender.isPresent()) {
                    chatMessage.setChatId(chatIdSender.get());
                }

                ChatMessage savedMsg = chatMessageService.save(chatMessage);

                // Create Notification Object
                ChatNotification notification = ChatNotification.builder()
                        .id(savedMsg.getId())
                        .senderId(savedMsg.getSenderId())
                        .recipientId(savedMsg.getRecipientId())
                        .content(savedMsg.getContent())
                        .type(savedMsg.getType())
                        .build();

                // 1. Send to RECIPIENT
                messagingTemplate.convertAndSend(
                        "/topic/" + chatMessage.getRecipientId(),
                        notification
                );

                // 2. [NEW] Send back to SENDER (So sender sees their own message)
                messagingTemplate.convertAndSend(
                        "/topic/" + chatMessage.getSenderId(),
                        notification
                );
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- API CREATE GROUP ---
    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoom> createGroup(@RequestBody Map<String, Object> payload) {
        String groupName = (String) payload.get("groupName");
        String adminId = (String) payload.get("adminId");
        List<String> memberIds = (List<String>) payload.get("memberIds");

        return ResponseEntity.ok(chatRoomService.createGroupChat(adminId, groupName, memberIds));
    }

    // 2. Typing Event Processing
    @MessageMapping("/typing")
    public void processTyping(@Payload TypingMessage typingMessage) {
        // Check if recipientId is a Group
        Optional<ChatRoom> groupRoom = chatRoomService.findByChatId(typingMessage.getRecipientId());

        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            // --- GROUP CASE ---
            ChatRoom room = groupRoom.get();
            // Send typing event to all members EXCEPT sender
            for (String memberId : room.getMemberIds()) {
                if (!memberId.equals(typingMessage.getSenderId())) {
                    messagingTemplate.convertAndSend(
                            "/topic/" + memberId,
                            typingMessage
                    );
                }
            }
        } else {
            // --- 1-1 CASE ---
            messagingTemplate.convertAndSend(
                    "/topic/" + typingMessage.getRecipientId(),
                    typingMessage
            );
        }
    }

    // 3. User Online Processing
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

    // 4. User Offline Processing
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

    // 5. Get User Status API
    @GetMapping("/rooms/status/{userId}")
    public ResponseEntity<UserStatus> getUserStatus(@PathVariable String userId) {
        return ResponseEntity.ok(userStatusService.getUserStatus(userId));
    }

    @GetMapping("/messages/{senderId}/{recipientId}")
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        // Note: Logic inside service handles both Group (by ChatId) and Private (by sender/recipient)
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }

    @GetMapping("/rooms/{userId}")
    public ResponseEntity<List<ChatRoom>> getChatRooms(@PathVariable String userId) {
        return ResponseEntity.ok(chatRoomService.getChatRooms(userId));
    }
}