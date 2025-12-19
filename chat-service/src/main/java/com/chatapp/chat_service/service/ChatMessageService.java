package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.NotificationClient;
import com.chatapp.chat_service.dto.NotificationRequest;
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

    public ChatMessage save(ChatMessage chatMessage, String senderName) {
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
                handleNotification(chatMessage, senderName);
            } catch (Exception e) {
                System.err.println(">> Lỗi gửi thông báo: " + e.getMessage());
                e.printStackTrace();
            }
        });

        return chatMessage;
    }

    private void handleNotification(ChatMessage message, String senderName) {
        // A. [UPDATED] Use actual senderName from Gateway header (passed from controller)
        // Only fallback to "Người lạ" (Stranger) if senderName is null or empty
        if (senderName == null || senderName.trim().isEmpty()) {
            System.out.println("⚠️ [ChatMessageService] senderName is null/empty, using fallback 'Người lạ'");
            senderName = "Người lạ";
        } else {
            System.out.println("✅ [ChatMessageService] Using senderName from Gateway: " + senderName);
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
                    System.out.println("📤 [ChatMessageService] Sending notification to group member " + memberId + " with senderName: " + senderName);
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
            System.out.println("📤 [ChatMessageService] Sending 1-1 notification to " + message.getRecipientId() + " with senderName: " + senderName);
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