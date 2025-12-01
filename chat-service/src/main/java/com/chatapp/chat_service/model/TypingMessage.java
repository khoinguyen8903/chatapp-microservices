package com.chatapp.chat_service.model;

import com.fasterxml.jackson.annotation.JsonProperty; // Import thư viện này
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TypingMessage {
    private String senderId;
    private String recipientId;

    // --- QUAN TRỌNG: Ép tên trường JSON là "isTyping" ---
    @JsonProperty("isTyping")
    private boolean isTyping;
}