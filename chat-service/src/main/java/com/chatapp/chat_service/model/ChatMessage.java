package com.chatapp.chat_service.model;

import com.chatapp.chat_service.enums.MessageType;
import com.chatapp.chat_service.enums.MessageStatus; // Import Enum mới
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "chat_messages")
public class ChatMessage {
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Reaction {
        private String userId;
        private String type; // emoji char, e.g. "❤️"
    }

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

    // --- [NEW] Message reactions ---
    @Builder.Default
    private List<Reaction> reactions = new ArrayList<>();
}