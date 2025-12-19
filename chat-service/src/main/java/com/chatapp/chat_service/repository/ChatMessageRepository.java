package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.model.ChatMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByChatId(String chatId);
    
    // [DEPRECATED] Old methods - keeping for backward compatibility
    long countByChatIdAndRecipientIdAndStatusNot(String chatId, String recipientId, MessageStatus status);
    long countByChatIdAndSenderIdNotAndStatusNot(String chatId, String senderId, MessageStatus status);
    
    // [NEW] More precise queries that explicitly check for SENT or DELIVERED status
    // For 1-1 chat: Count messages sent TO userId that are SENT or DELIVERED (not yet SEEN)
    @Query(value = "{ 'chatId': ?0, 'recipientId': ?1, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
    long countUnreadMessagesForRecipient(String chatId, String recipientId);
    
    // For group chat: Count messages NOT sent BY userId that are SENT or DELIVERED (not yet SEEN)
    @Query(value = "{ 'chatId': ?0, 'senderId': { $ne: ?1 }, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
    long countUnreadMessagesInGroup(String chatId, String userId);
}