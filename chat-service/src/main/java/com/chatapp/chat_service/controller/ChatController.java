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
        // --- LOG DEBUG 1: Kiểm tra xem tin nhắn có tới được Controller không ---
        System.out.println("DEBUG: Nhận tin nhắn từ: " + chatMessage.getSenderId());
        System.out.println("DEBUG: Gửi tới: " + chatMessage.getRecipientId());
        System.out.println("DEBUG: Nội dung: " + chatMessage.getContent());

        try {
            // 1. Logic phòng chat
            Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                    chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

            chatRoomService.getChatRoomId(
                    chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

            if (chatIdSender.isPresent()) {
                chatMessage.setChatId(chatIdSender.get());
            }

            // 2. Lưu tin nhắn
            ChatMessage savedMsg = chatMessageService.save(chatMessage);
            System.out.println("DEBUG: Đã lưu tin nhắn vào DB với ID: " + savedMsg.getId());

            // 3. Gửi thông báo
            String destination = "/topic/" + chatMessage.getRecipientId();
            System.out.println("DEBUG: Đang gửi tới kênh: " + destination);

            messagingTemplate.convertAndSend(
                    destination,
                    ChatNotification.builder()
                            .id(savedMsg.getId())
                            .senderId(savedMsg.getSenderId())
                            .recipientId(savedMsg.getRecipientId())
                            .content(savedMsg.getContent())
                            .build()
            );
            System.out.println("DEBUG: Đã gửi thông báo thành công!");

        } catch (Exception e) {
            // --- LOG DEBUG 2: Bắt lỗi nếu có ---
            System.err.println("DEBUG ERROR: Lỗi khi xử lý tin nhắn!");
            e.printStackTrace();
        }
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