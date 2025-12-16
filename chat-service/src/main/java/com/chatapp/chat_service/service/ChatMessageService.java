package com.chatapp.chat_service.service;

import com.chatapp.chat_service.client.NotificationClient;
import com.chatapp.chat_service.dto.NotificationRequest; // Nhớ import đúng DTO
import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.model.ChatRoom; // Import ChatRoom
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

    public ChatMessage save(ChatMessage chatMessage) {
        // 1. Xử lý logic Chat ID (Giữ nguyên)
        if (chatMessage.getChatId() == null || chatMessage.getChatId().isEmpty()) {
            // Trường hợp này thường chỉ xảy ra ở chat 1-1 lần đầu
            var chatId = chatRoomService
                    .getChatRoomId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true)
                    .orElseThrow();
            chatMessage.setChatId(chatId);
        }

        // 2. Lưu tin nhắn vào DB
        repository.save(chatMessage);

        // 3. Xử lý Thông Báo (Async)
        CompletableFuture.runAsync(() -> {
            try {
                handleNotification(chatMessage);
            } catch (Exception e) {
                System.err.println(">> Lỗi gửi thông báo: " + e.getMessage());
            }
        });

        return chatMessage;
    }

    // --- [HÀM MỚI] Tách logic thông báo ra riêng để xử lý Nhóm/Lẻ ---
    private void handleNotification(ChatMessage message) {
        // Kiểm tra xem recipientId có phải là một ID của Phòng Chat Nhóm không
        // (Trong logic Chat Nhóm, Frontend thường gửi recipientId = GroupId)
        Optional<ChatRoom> chatRoomOpt = chatRoomService.findByChatId(message.getRecipientId());

        if (chatRoomOpt.isPresent() && chatRoomOpt.get().isGroup()) {
            // === TRƯỜNG HỢP 1: CHAT NHÓM ===
            ChatRoom group = chatRoomOpt.get();
            List<String> members = group.getMemberIds();

            // Duyệt qua từng thành viên để gửi thông báo
            for (String memberId : members) {
                // Đừng gửi cho chính người viết tin nhắn
                if (!memberId.equals(message.getSenderId())) {
                    NotificationRequest notiReq = new NotificationRequest(
                            memberId, // Gửi cho từng thành viên
                            "Tin nhắn từ nhóm: " + group.getGroupName(), // Tiêu đề là tên nhóm
                            message.getSenderId() + ": " + message.getContent() // Nội dung: "Hùng: Alo mọi người"
                    );
                    notificationClient.sendNotification(notiReq);
                }
            }
        } else {
            // === TRƯỜNG HỢP 2: CHAT 1-1 ===
            // Với chat 1-1, recipientId chính là User ID người nhận
            NotificationRequest notiReq = new NotificationRequest(
                    message.getRecipientId(),
                    "Tin nhắn mới từ " + message.getSenderId(),
                    message.getContent()
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
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn với ID: " + id));
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

        if (!messagesToUpdate.isEmpty()) {
            repository.saveAll(messagesToUpdate);
        }
        return messagesToUpdate;
    }
}