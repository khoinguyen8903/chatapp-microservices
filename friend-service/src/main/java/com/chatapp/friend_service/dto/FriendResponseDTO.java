package com.chatapp.friend_service.dto;

import com.chatapp.friend_service.enums.RequestStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendResponseDTO {

    private String id;
    private String senderId;
    private String receiverId;
    private RequestStatus status;
    private String message;
    private LocalDateTime createdAt;
}

