package com.chatapp.chat_service.controller;

import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatNotification;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.model.TypingMessage; // Đừng quên import Model này
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

    // 1. Xử lý tin nhắn Chat
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage) {
        // --- LOG DEBUG (Có thể giữ lại hoặc xóa đi nếu đã chạy ngon) ---
        System.out.println("DEBUG: Nhận tin nhắn từ: " + chatMessage.getSenderId());

        try {
            // Kiểm tra và tạo phòng chat
            Optional<String> chatIdSender = chatRoomService.getChatRoomId(
                    chatMessage.getSenderId(), chatMessage.getRecipientId(), true);

            chatRoomService.getChatRoomId(
                    chatMessage.getRecipientId(), chatMessage.getSenderId(), true);

            if (chatIdSender.isPresent()) {
                chatMessage.setChatId(chatIdSender.get());
            }

            // Lưu tin nhắn
            ChatMessage savedMsg = chatMessageService.save(chatMessage);

            // Gửi thông báo tới Topic của người nhận
            messagingTemplate.convertAndSend(
                    "/topic/" + chatMessage.getRecipientId(),
                    ChatNotification.builder()
                            .id(savedMsg.getId())
                            .senderId(savedMsg.getSenderId())
                            .recipientId(savedMsg.getRecipientId())
                            .content(savedMsg.getContent())
                            .build()
            );
            System.out.println("DEBUG: Đã gửi tới /topic/" + chatMessage.getRecipientId());

        } catch (Exception e) {
            System.err.println("DEBUG ERROR: Lỗi khi xử lý tin nhắn!");
            e.printStackTrace();
        }
    }

    // 2. MỚI THÊM: Xử lý sự kiện Typing (Đang nhập...)
    @MessageMapping("/typing")
    public void processTyping(@Payload TypingMessage typingMessage) {
        // Không lưu vào Database, chỉ chuyển tiếp (forward) ngay lập tức
        // Gửi đến kênh topic của người nhận
        messagingTemplate.convertAndSend(
                "/topic/" + typingMessage.getRecipientId(),
                typingMessage
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