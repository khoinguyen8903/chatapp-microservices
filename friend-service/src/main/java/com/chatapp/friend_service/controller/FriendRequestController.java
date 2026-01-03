package com.chatapp.friend_service.controller;

import com.chatapp.friend_service.dto.FriendRequestDTO;
import com.chatapp.friend_service.dto.FriendResponseDTO;
import com.chatapp.friend_service.service.FriendRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/friends/requests")
@RequiredArgsConstructor
public class FriendRequestController {

    private final FriendRequestService friendRequestService;

    @PostMapping("/send")
    public ResponseEntity<FriendResponseDTO> sendFriendRequest(@Valid @RequestBody FriendRequestDTO requestDTO) {
        return ResponseEntity.ok(friendRequestService.sendFriendRequest(requestDTO));
    }

    @GetMapping("/received")
    public ResponseEntity<List<FriendResponseDTO>> getReceivedRequests() {
        return ResponseEntity.ok(friendRequestService.getReceivedRequests());
    }

    @GetMapping("/sent")
    public ResponseEntity<List<FriendResponseDTO>> getSentRequests() {
        return ResponseEntity.ok(friendRequestService.getSentRequests());
    }

    @PutMapping("/{requestId}/accept")
    public ResponseEntity<Void> acceptRequest(@PathVariable String requestId) {
        friendRequestService.acceptRequest(requestId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{requestId}/reject")
    public ResponseEntity<Void> rejectRequest(@PathVariable String requestId) {
        friendRequestService.rejectRequest(requestId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<Void> cancelRequest(@PathVariable String requestId) {
        friendRequestService.cancelRequest(requestId);
        return ResponseEntity.noContent().build();
    }
}

