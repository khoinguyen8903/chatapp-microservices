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
    private String content;
    private MessageStatus status;

    // --- [THÊM MỚI] ---
    private MessageType type;
}