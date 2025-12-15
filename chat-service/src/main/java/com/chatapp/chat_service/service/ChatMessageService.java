package com.chatapp.chat_service.service;

import com.chatapp.chat_service.enums.MessageStatus; // [MỚI] Import Enum
import com.chatapp.chat_service.model.ChatMessage;
import com.chatapp.chat_service.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatMessageService {

    @Autowired private ChatMessageRepository repository;
    @Autowired private ChatRoomService chatRoomService;

    public ChatMessage save(ChatMessage chatMessage) {
        // Mặc định status là SENT khi lưu mới (đã config trong Model)

        // Logic tìm ChatId như cũ
        if (chatMessage.getChatId() == null || chatMessage.getChatId().isEmpty()) {
            var chatId = chatRoomService
                    .getChatRoomId(chatMessage.getSenderId(), chatMessage.getRecipientId(), true)
                    .orElseThrow();
            chatMessage.setChatId(chatId);
        }

        repository.save(chatMessage);
        return chatMessage;
    }

    public List<ChatMessage> findChatMessages(String senderId, String recipientId) {
        var groupRoom = chatRoomService.findByChatId(recipientId);

        if (groupRoom.isPresent() && groupRoom.get().isGroup()) {
            return repository.findByChatId(recipientId);
        } else {
            var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);
            return chatId.map(repository::findByChatId).orElse(new ArrayList<>());
        }
    }

    // --- [MỚI] Tìm tin nhắn theo ID ---
    public ChatMessage findById(String id) {
        return repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tin nhắn với ID: " + id));
    }

    // --- [MỚI] Cập nhật trạng thái tin nhắn (Dùng cho DELIVERED) ---
    public void updateStatus(String id, MessageStatus status) {
        repository.findById(id).ifPresent(message -> {
            message.setStatus(status);
            repository.save(message);
        });
    }

    // --- [MỚI - QUAN TRỌNG] Cập nhật trạng thái hàng loạt (Dùng cho SEEN) ---
    // senderId: Người GỬI tin nhắn (Người kia)
    // recipientId: Người NHẬN tin nhắn (Là mình, người đang mở khung chat)
    public List<ChatMessage> updateStatuses(String senderId, String recipientId, MessageStatus status) {
        // 1. Tìm chatId của 2 người
        var chatId = chatRoomService.getChatRoomId(senderId, recipientId, false);

        if (chatId.isEmpty()) return new ArrayList<>();

        // 2. Lấy tất cả tin nhắn trong cuộc hội thoại
        List<ChatMessage> messages = repository.findByChatId(chatId.get());

        // 3. Lọc ra các tin nhắn do "Người kia" gửi mà chưa có trạng thái mới
        List<ChatMessage> messagesToUpdate = messages.stream()
                .filter(msg -> msg.getSenderId().equals(senderId)) // Chỉ update tin của người kia gửi
                .filter(msg -> msg.getStatus() != status)          // Chỉ update nếu status khác nhau
                .peek(msg -> msg.setStatus(status))                // Set status mới (SEEN)
                .collect(Collectors.toList());

        // 4. Lưu lại vào DB
        if (!messagesToUpdate.isEmpty()) {
            repository.saveAll(messagesToUpdate);
            repository.saveAll(messagesToUpdate);
        }

        // 5. Trả về danh sách đã update để Controller bắn socket báo cho người kia biết
        return messagesToUpdate;
    }
}