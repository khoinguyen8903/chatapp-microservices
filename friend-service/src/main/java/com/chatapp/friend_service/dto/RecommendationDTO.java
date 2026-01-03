package com.chatapp.friend_service.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationDTO {

    private UserDTO user;
    private List<String> mutualFriends;
    private String reason;
}

