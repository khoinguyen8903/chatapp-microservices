package com.chatapp.friend_service.controller;

import com.chatapp.friend_service.dto.FriendDTO;
import com.chatapp.friend_service.dto.FriendStatusDTO;
import com.chatapp.friend_service.service.BlockedUserService;
import com.chatapp.friend_service.service.FriendService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendController {

    private final FriendService friendService;
    private final BlockedUserService blockedUserService;

    @GetMapping
    public ResponseEntity<List<FriendDTO>> getFriends() {
        return ResponseEntity.ok(friendService.getFriends());
    }

    @GetMapping("/{friendId}/status")
    public ResponseEntity<FriendStatusDTO> getFriendStatus(@PathVariable String friendId) {
        return ResponseEntity.ok(friendService.getFriendStatus(friendId));
    }

    @DeleteMapping("/{friendId}")
    public ResponseEntity<Void> unfriend(@PathVariable String friendId) {
        friendService.unfriend(friendId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/block")
    public ResponseEntity<Void> blockUser(
            @PathVariable String userId,
            @RequestParam(required = false) String reason) {
        blockedUserService.blockUser(userId, reason);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{userId}/block")
    public ResponseEntity<Void> unblockUser(@PathVariable String userId) {
        blockedUserService.unblockUser(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/blocked")
    public ResponseEntity<List<?>> getBlockedUsers() {
        return ResponseEntity.ok(blockedUserService.getBlockedUsers());
    }
}

