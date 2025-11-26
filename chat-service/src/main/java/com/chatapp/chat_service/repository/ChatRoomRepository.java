package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.model.ChatRoom;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {
    Optional<ChatRoom> findBySenderIdAndRecipientId(String senderId, String recipientId);
}