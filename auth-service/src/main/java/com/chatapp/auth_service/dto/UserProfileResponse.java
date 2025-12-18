package com.chatapp.auth_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileResponse {
    private String id;
    private String username;
    private String fullName;
    private String email;
    private String phone;
    private String bio;
    private String avatarUrl;
    private Boolean isActive;
}

