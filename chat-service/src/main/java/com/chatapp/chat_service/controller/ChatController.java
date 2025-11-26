package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatNotification; // Đã có file này nên Import OK
import com.chatapp.chat_service.service.ChatMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@Controller
public class ChatController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private ChatMessageService chatMessageService;

    // WebSocket: Nhận tin nhắn -> Lưu DB -> Bắn Notification cho người nhận
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        // 1. Lưu toàn bộ thông tin vào DB
        ChatMessage savedMsg = chatMessageService.save(chatMessage);

        // 2. Chỉ gửi thông báo (Notification) gọn nhẹ cho người nhận
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

    // REST API: Lấy lịch sử thì trả về đầy đủ ChatMessage
    @GetMapping("/messages/{senderId}/{recipientId}")
    public ResponseEntity<List<ChatMessage>> findChatMessages(@PathVariable String senderId,
                                                              @PathVariable String recipientId) {
        return ResponseEntity.ok(chatMessageService.findChatMessages(senderId, recipientId));
    }
}