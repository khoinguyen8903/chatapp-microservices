package com.chatapp.friend_service.controller;

import com.chatapp.friend_service.dto.RecommendationDTO;
import com.chatapp.friend_service.dto.UserDTO;
import com.chatapp.friend_service.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendRecommendationController {

    private final RecommendationService recommendationService;

    @GetMapping("/recommendations")
    public ResponseEntity<List<RecommendationDTO>> getRecommendations() {
        return ResponseEntity.ok(recommendationService.getRecommendations());
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam String keyword) {
        return ResponseEntity.ok(recommendationService.searchUsers(keyword));
    }
}

