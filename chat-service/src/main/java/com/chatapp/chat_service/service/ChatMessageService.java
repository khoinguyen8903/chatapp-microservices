package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.NotificationClient;
import com.chatapp.chat_service.client.UserClient; // [QUAN TRỌNG] Dùng Client
import com.chatapp.chat_service.dto.NotificationRequest;
import com.chatapp.chat_service.dto.UserDTO; // [QUAN TRỌNG] Dùng DTO
import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatRoom;
import com.chatapp.chat_service.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
public class ChatMessageService {

    @Autowired private ChatMessageRepository repository;
    @Autowired private ChatRoomService chatRoomService;
    @Autowired private NotificationClient notificationClient;

    // [SỬA] Inject UserClient thay vì UserRepository
    @Autowired private UserClient userClient;

    public ChatMessage save(ChatMessage chatMessage) {
        // 1. Logic tạo Chat ID nếu chưa có
        if (chatMessage.getChatId() == null || chatMessage.getChatId().isEmpty()) {
            var chatId = chatRoomService
                    .getChatRoomId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true)
                    .orElseThrow();
            chatMessage.setChatId(chatId);
        }

        // 2. Lưu tin nhắn
        repository.save(chatMessage);

        // 3. Gửi thông báo bất đồng bộ (Async)
        CompletableFuture.runAsync(() -> {
            try {
                handleNotification(chatMessage);
            } catch (Exception e) {
                System.err.println(">> Lỗi gửi thông báo: " + e.getMessage());
                e.printStackTrace();
            }
        });

        return chatMessage;
    }

    private void handleNotification(ChatMessage message) {
        // A. [FIX TÊN] Lấy USERNAME từ Auth Service
        String senderName = "Người lạ";
        try {
            // Gọi sang Auth Service
            UserDTO userDto = userClient.getUserById(message.getSenderId());

            // [SỬA LẠI THEO YÊU CẦU] Lấy username thay vì fullName
            if (userDto != null && userDto.getUsername() != null) {
                senderName = userDto.getUsername();
            }
        } catch (Exception e) {
            System.out.println("Không lấy được username user: " + message.getSenderId());
        }

        // B. [FIX URL] Xử lý nội dung thông báo gọn gàng
        String notificationBody = "Bạn có tin nhắn mới";
        MessageType type = message.getType();

        if (type == MessageType.TEXT) {
            notificationBody = message.getContent();
            if (notificationBody != null && notificationBody.length() > 50) {
                notificationBody = notificationBody.substring(0, 47) + "...";
            }
        } else if (type == MessageType.IMAGE) {
            notificationBody = "📷 Đã gửi một ảnh";
        } else if (type == MessageType.VIDEO) {
            notificationBody = "🎥 Đã gửi một video";
        } else if (type == MessageType.FILE) {
            notificationBody = "📎 Đã gửi một tập tin";
        }

        // C. Gửi thông báo
        Optional<ChatRoom> chatRoomOpt = chatRoomService.findByChatId(message.getRecipientId());

        if (chatRoomOpt.isPresent() && chatRoomOpt.get().isGroup()) {
            // Chat Nhóm
            ChatRoom group = chatRoomOpt.get();
            for (String memberId : group.getMemberIds()) {
                if (!memberId.equals(message.getSenderId())) {
                    NotificationRequest notiReq = new NotificationRequest(
                            memberId,
                            senderName, // Username người gửi
                            notificationBody,
                            message.getChatId()
                    );
                    notificationClient.sendNotification(notiReq);
                }
            }
        } else {
            // Chat 1-1
            NotificationRequest notiReq = new NotificationRequest(
                    message.getRecipientId(),
                    senderName, // Username người gửi
                    notificationBody,
                    message.getChatId()
            );
            notificationClient.sendNotification(notiReq);
        }
    }

    // --- CÁC HÀM KHÁC GIỮ NGUYÊN ---

    public List<ChatMessage> findChatMessages(String senderId, String recipientId) {
        var groupRoom = chatRoomService.findByChatId(recipientId);
        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            return repository.findByChatId(recipientId);
        } else {
            var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);
            return chatId.map(repository::findByChatId).orElse(new ArrayList<>());
        }
    }

    public ChatMessage findById(String id) {
        return repository.findById(id).orElseThrow(() -> new RuntimeException("Not found"));
    }

    public void updateStatus(String id, MessageStatus status) {
        repository.findById(id).ifPresent(message -> {
            message.setStatus(status);
            repository.save(message);
        });
    }

    public List<ChatMessage> updateStatuses(String senderId, String recipientId, MessageStatus status) {
        var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);
        if (chatId.isEmpty()) return new ArrayList<>();

        List<ChatMessage> messages = repository.findByChatId(chatId.get());
        List<ChatMessage> messagesToUpdate = messages.stream()
                .filter(msg -> msg.getSenderId().equals(senderId))
                .filter(msg -> msg.getStatus() != status)
                .peek(msg -> msg.setStatus(status))
                .collect(Collectors.toList());

        if (!messagesToUpdate.isEmpty()) repository.saveAll(messagesToUpdate);
        return messagesToUpdate;
    }
}