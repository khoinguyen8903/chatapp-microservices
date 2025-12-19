package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.model.ChatRoom;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {

    // Tìm chat 1-1 (Logic cũ)
    List<ChatRoom> findBySenderId(String senderId);
    Optional<ChatRoom> findBySenderIdAndRecipientId(String senderId, String recipientId);


    // Tìm phòng (cả nhóm và 1-1) mà user có tham gia
    List<ChatRoom> findByMemberIdsContaining(String memberId);

    // [UNIQUE MODEL] Tìm theo ChatId - Returns Optional because each chatId is now unique
    // With the new model, there's only ONE ChatRoom per chatId (not two)
    Optional<ChatRoom> findByChatId(String chatId);
}