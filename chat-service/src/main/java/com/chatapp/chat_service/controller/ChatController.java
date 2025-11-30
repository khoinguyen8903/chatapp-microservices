package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatNotification;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.service.ChatMessageService;
import com.chatapp.chat_service.service.ChatRoomService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;
import java.util.Optional;

@Controller
public class ChatController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private ChatMessageService chatMessageService;
    @Autowired private ChatRoomService chatRoomService;

    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        // 1. Kiểm tra và tạo ChatRoom nếu chưa tồn tại

        // Tạo ChatRoom cho Người Gửi (Sender) -> Gọi đúng tên hàm getChatRoomId
        Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

        // Tạo ChatRoom cho Người Nhận (Recipient) -> Gọi đúng tên hàm getChatRoomId
        Optional<String> chatIdRecipient = chatRoomService.getChatRoomId(
                chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

        // Gán chatId vào tin nhắn để lưu vết
        if (chatIdSender.isPresent()) {
            chatMessage.setChatId(chatIdSender.get());
        }

        // 2. Lưu tin nhắn
        ChatMessage savedMsg = chatMessageService.save(chatMessage);

        // 3. Gửi thông báo real-time
        messagingTemplate.convertAndSendToUser(
                chatMessage.getRecipientId(), "/queue/messages",
                ChatNotification.builder()
                        .id(savedMsg.getId())
                        .senderId(savedMsg.getSenderId())
                        .recipientId(savedMsg.getRecipientId())
                        .content(savedMsg.getContent())
                        .build()
        );
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