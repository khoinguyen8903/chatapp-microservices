package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.model.ChatRoom;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {
    // Tìm phòng chat cụ thể giữa 2 người (đã có)
    Optional<ChatRoom> findBySenderIdAndRecipientId(String senderId, String recipientId);

    // --- THÊM MỚI: Tìm danh sách tất cả phòng chat của một user ---
    List<ChatRoom> findBySenderId(String senderId);
}