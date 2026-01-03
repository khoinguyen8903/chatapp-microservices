package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.model.ChatMessage;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import java.util.Date;
import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    List<ChatMessage> findByChatId(String chatId);
    void deleteByChatId(String chatId);  // [NEW] Delete all messages in a chat room
    
    // [DEPRECATED] Old methods - keeping for backward compatibility
    long countByChatIdAndRecipientIdAndStatusNot(String chatId, String recipientId, MessageStatus status);
    long countByChatIdAndSenderIdNotAndStatusNot(String chatId, String senderId, MessageStatus status);
    
    // [NEW] More precise queries that explicitly check for SENT or DELIVERED status
    // For 1-1 chat: Count messages sent TO userId that are SENT or DELIVERED (not yet SEEN)
    // CRITICAL: Also ensures senderId != recipientId to exclude messages sent by the user
    @Query(value = "{ 'chatId': ?0, 'recipientId': ?1, 'senderId': { $ne: ?1 }, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
    long countUnreadMessagesForRecipient(String chatId, String recipientId);
    
    // For group chat: Count messages NOT sent BY userId that are SENT or DELIVERED (not yet SEEN)
    @Query(value = "{ 'chatId': ?0, 'senderId': { $ne: ?1 }, 'status': { $in: ['SENT', 'DELIVERED'] } }", count = true)
    long countUnreadMessagesInGroup(String chatId, String userId);

    // --- [MEDIA & FILES SECTION] ---
    // Find messages by chatId and type(s), sorted by timestamp descending
    List<ChatMessage> findByChatIdAndTypeIn(String chatId, List<MessageType> types, Sort sort);
    
    // Find messages by recipientId (for private chat as partnerId) and type(s)
    @Query("{ '$or': [ {'chatId': ?0}, {'senderId': ?0}, {'recipientId': ?0} ], 'type': { $in: ?1 } }")
    List<ChatMessage> findByParticipantAndTypeIn(String participantId, List<MessageType> types, Sort sort);

    // --- [SEARCH IN CONVERSATION] ---
    // Text search in content field - requires text index on 'content' field
    @Query("{ '$or': [ {'chatId': ?0}, {'senderId': ?0}, {'recipientId': ?0} ], 'content': { $regex: ?1, $options: 'i' } }")
    List<ChatMessage> searchByContentInChat(String chatId, String keyword, Sort sort);

    // --- [MESSAGES AROUND TARGET] ---
    // Find messages before a timestamp (older messages), sorted descending
    List<ChatMessage> findByChatIdAndTimestampBeforeOrderByTimestampDesc(String chatId, Date timestamp);

    // Find messages after a timestamp (newer messages), sorted ascending
    List<ChatMessage> findByChatIdAndTimestampAfterOrderByTimestampAsc(String chatId, Date timestamp);
}
