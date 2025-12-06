package com.chatapp.chat_service.model;

import com.chatapp.chat_service.enums.MessageType; // Import Enum vừa tạo
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
    private String content; // Nếu type=IMAGE thì content là URL ảnh

    private Date timestamp;

    // --- [THÊM MỚI] ---
    // Mặc định nếu không gửi gì thì là TEXT
    @Builder.Default
    private MessageType type = MessageType.TEXT;
}