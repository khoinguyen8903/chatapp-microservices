package com.chatapp.chat_service.model;

import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.enums.MessageStatus; // Import Enum mới
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "chat_messages")
public class ChatMessage {
    @Id
    private String id;
    private String chatId;
    private String senderId;
    private String recipientId;
    private String content;
    private String fileName; // Original filename for file attachments

    private Date timestamp;

    @Builder.Default
    private MessageType type = MessageType.TEXT;

    // --- [THÊM MỚI TRẠNG THÁI] ---
    @Builder.Default
    private MessageStatus status = MessageStatus.SENT;
}