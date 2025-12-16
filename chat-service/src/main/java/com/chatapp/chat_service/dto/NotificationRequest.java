package com.chatapp.chat_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRequest {
    private String userId; // Gửi ID người nhận, bên kia sẽ tự tra Redis ra Token
    private String title;
    private String body;

    // Constructor, Getter, Setter, AllArgsConstructor...
}
