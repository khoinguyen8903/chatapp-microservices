package com.chatapp.chat_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class ReactionRequest {
    private String messageId;
    private String userId;
    private String chatId;
    private String type; // emoji char, e.g. "❤️"
}


