package com.chatapp.chat_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleActionRequest {
    private String targetUserId;
    private String action;  // 'PROMOTE' or 'DEMOTE'
}

