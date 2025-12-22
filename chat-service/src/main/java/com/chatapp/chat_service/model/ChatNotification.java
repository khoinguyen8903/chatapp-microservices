package com.chatapp.chat_service.model;

import com.chatapp.chat_service.enums.MessageStatus;
import com.chatapp.chat_service.enums.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ChatNotification {
    private String id;
    private String senderId;
    private String recipientId;
    private String chatId;  // [CRITICAL] Explicit chatId to prevent unread count leakage
    private String content;
    private String fileName; // Original filename for file attachments
    private MessageStatus status;
    private String senderName;

    // --- [THÊM MỚI] ---
    private MessageType type;
    
    // --- [NEW] Message management fields ---
    private String replyToId; // ID of the message being replied to
    private String messageStatus; // 'SENT' or 'REVOKED'
}