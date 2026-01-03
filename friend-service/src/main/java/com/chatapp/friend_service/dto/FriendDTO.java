package com.chatapp.friend_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendDTO {

    private String id;
    private String userId;
    private String friendId;
    private String friendUsername;
    private String friendFullName;
    private String friendAvatarUrl;
    private String status;
    private LocalDateTime createdAt;
}

