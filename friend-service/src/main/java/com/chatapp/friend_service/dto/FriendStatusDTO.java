package com.chatapp.friend_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendStatusDTO {

    private String userId;
    private String status; // NOT_FRIENDS, PENDING_REQUEST, ARE_FRIENDS, BLOCKED
    private boolean canSendRequest;
}

