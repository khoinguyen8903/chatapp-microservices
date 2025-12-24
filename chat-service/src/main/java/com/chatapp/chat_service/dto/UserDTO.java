package com.chatapp.chat_service.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private String id;
    private String username; // Chúng ta sẽ lấy trường này
    private String fullName;
    private String avatarUrl; // Avatar URL for display
}