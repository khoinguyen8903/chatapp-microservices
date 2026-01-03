package com.chatapp.friend_service.service;

import com.chatapp.friend_service.client.AuthClient;
import com.chatapp.friend_service.client.NotificationClient;
import com.chatapp.friend_service.dto.FriendRequestDTO;
import com.chatapp.friend_service.dto.FriendResponseDTO;
import com.chatapp.friend_service.entity.FriendRequest;
import com.chatapp.friend_service.entity.Friendship;
import com.chatapp.friend_service.enums.RequestStatus;
import com.chatapp.friend_service.exception.AlreadyFriendsException;
import com.chatapp.friend_service.exception.RequestAlreadyExistsException;
import com.chatapp.friend_service.exception.UserBlockedException;
import com.chatapp.friend_service.repository.BlockedUserRepository;
import com.chatapp.friend_service.repository.FriendRequestRepository;
import com.chatapp.friend_service.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class FriendRequestService {

    private final FriendRequestRepository friendRequestRepository;
    private final FriendshipRepository friendshipRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final AuthClient authClient;
    private final NotificationClient notificationClient;

    private String getCurrentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
    }

    @Transactional
    public FriendResponseDTO sendFriendRequest(FriendRequestDTO requestDTO) {
        String senderId = getCurrentUserId();
        String receiverId = requestDTO.getReceiverId();

        log.info("Sending friend request from {} to {}", senderId, receiverId);

        // Validate user exists
        try {
            authClient.getUserById(receiverId);
        } catch (Exception e) {
            throw new RuntimeException("Receiver user not found");
        }

        // Check if already friends
        if (friendshipRepository.existsByUserIdAndFriendId(senderId, receiverId) ||
            friendshipRepository.existsByUserIdAndFriendId(receiverId, senderId)) {
            throw new AlreadyFriendsException("You are already friends with this user");
        }

        // Check if request already exists
        if (friendRequestRepository.existsBySenderIdAndReceiverId(senderId, receiverId) ||
            friendRequestRepository.existsBySenderIdAndReceiverId(receiverId, senderId)) {
            throw new RequestAlreadyExistsException("Friend request already exists");
        }

        // Check if blocked
        if (blockedUserRepository.existsByBlockerIdAndBlockedId(senderId, receiverId) ||
            blockedUserRepository.existsByBlockerIdAndBlockedId(receiverId, senderId)) {
            throw new UserBlockedException("Cannot send friend request - user is blocked");
        }

        // Create friend request
        FriendRequest friendRequest = FriendRequest.builder()
                .id(UUID.randomUUID().toString())
                .senderId(senderId)
                .receiverId(receiverId)
                .status(RequestStatus.PENDING)
                .message(requestDTO.getMessage())
                .build();

        friendRequestRepository.save(friendRequest);

        // Send notification
        Map<String, Object> notification = new HashMap<>();
        notification.put("userId", receiverId);
        notification.put("type", "FRIEND_REQUEST");
        notification.put("title", "New Friend Request");
        notification.put("message", "You have received a new friend request");
        notification.put("data", Map.of(
                "requestId", friendRequest.getId(),
                "senderId", senderId
        ));

        try {
            notificationClient.sendNotification(notification);
        } catch (Exception e) {
            log.warn("Failed to send notification: {}", e.getMessage());
        }

        return mapToResponseDTO(friendRequest);
    }

    public List<FriendResponseDTO> getReceivedRequests() {
        String userId = getCurrentUserId();
        List<FriendRequest> requests = friendRequestRepository
                .findByReceiverIdAndStatus(userId, RequestStatus.PENDING);
        return requests.stream().map(this::mapToResponseDTO).toList();
    }

    public List<FriendResponseDTO> getSentRequests() {
        String userId = getCurrentUserId();
        List<FriendRequest> requests = friendRequestRepository
                .findBySenderIdAndStatus(userId, RequestStatus.PENDING);
        return requests.stream().map(this::mapToResponseDTO).toList();
    }

    @Transactional
    public void acceptRequest(String requestId) {
        String userId = getCurrentUserId();

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!request.getReceiverId().equals(userId)) {
            throw new RuntimeException("You are not authorized to accept this request");
        }

        // Update request status
        request.setStatus(RequestStatus.ACCEPTED);
        friendRequestRepository.save(request);

        // Create friendship
        Friendship friendship1 = Friendship.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getSenderId())
                .friendId(request.getReceiverId())
                .status(com.chatapp.friend_service.enums.FriendStatus.ACCEPTED)
                .build();

        Friendship friendship2 = Friendship.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getReceiverId())
                .friendId(request.getSenderId())
                .status(com.chatapp.friend_service.enums.FriendStatus.ACCEPTED)
                .build();

        friendshipRepository.save(friendship1);
        friendshipRepository.save(friendship2);

        // Send notification to sender
        Map<String, Object> notification = new HashMap<>();
        notification.put("userId", request.getSenderId());
        notification.put("type", "FRIEND_ACCEPTED");
        notification.put("title", "Friend Request Accepted");
        notification.put("message", "Your friend request has been accepted");
        notification.put("data", Map.of("friendId", request.getReceiverId()));

        try {
            notificationClient.sendNotification(notification);
        } catch (Exception e) {
            log.warn("Failed to send notification: {}", e.getMessage());
        }
    }

    @Transactional
    public void rejectRequest(String requestId) {
        String userId = getCurrentUserId();

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!request.getReceiverId().equals(userId)) {
            throw new RuntimeException("You are not authorized to reject this request");
        }

        request.setStatus(RequestStatus.REJECTED);
        friendRequestRepository.save(request);
    }

    @Transactional
    public void cancelRequest(String requestId) {
        String userId = getCurrentUserId();

        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Friend request not found"));

        if (!request.getSenderId().equals(userId)) {
            throw new RuntimeException("You are not authorized to cancel this request");
        }

        friendRequestRepository.deleteById(requestId);
    }

    private FriendResponseDTO mapToResponseDTO(FriendRequest request) {
        return FriendResponseDTO.builder()
                .id(request.getId())
                .senderId(request.getSenderId())
                .receiverId(request.getReceiverId())
                .status(request.getStatus())
                .message(request.getMessage())
                .createdAt(request.getCreatedAt())
                .build();
    }
}

