package com.chatapp.friend_service.service;

import com.chatapp.friend_service.client.AuthClient;
import com.chatapp.friend_service.dto.FriendDTO;
import com.chatapp.friend_service.dto.FriendStatusDTO;
import com.chatapp.friend_service.entity.Friendship;
import com.chatapp.friend_service.enums.FriendStatus;
import com.chatapp.friend_service.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class FriendService {

    private final FriendshipRepository friendshipRepository;
    private final AuthClient authClient;
    private final com.chatapp.friend_service.repository.BlockedUserRepository blockedUserRepository;

    private String getCurrentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
    }

    public List<FriendDTO> getFriends() {
        String userId = getCurrentUserId();
        List<Friendship> friendships = friendshipRepository.findByUserIdAndStatus(userId, FriendStatus.ACCEPTED);

        return friendships.stream().map(friendship -> {
            try {
                var userResponse = authClient.getUserById(friendship.getFriendId());
                var userDTO = userResponse.toUserDTO();

                return FriendDTO.builder()
                        .id(friendship.getId())
                        .userId(friendship.getUserId())
                        .friendId(friendship.getFriendId())
                        .friendUsername(userDTO.getUsername())
                        .friendFullName(userDTO.getFullName())
                        .friendAvatarUrl(userDTO.getAvatarUrl())
                        .status(friendship.getStatus().name())
                        .createdAt(friendship.getCreatedAt())
                        .build();
            } catch (Exception e) {
                log.error("Failed to fetch user info for friend: {}", friendship.getFriendId(), e);
                return null;
            }
        }).filter(friend -> friend != null).toList();
    }

    public FriendStatusDTO getFriendStatus(String targetUserId) {
        String currentUserId = getCurrentUserId();

        // Check if blocked
        if (blockedUserRepository.existsByBlockerIdAndBlockedId(currentUserId, targetUserId)) {
            return FriendStatusDTO.builder()
                    .userId(targetUserId)
                    .status("BLOCKED")
                    .canSendRequest(false)
                    .build();
        }

        // Check if already friends
        if (friendshipRepository.existsByUserIdAndFriendId(currentUserId, targetUserId) ||
            friendshipRepository.existsByUserIdAndFriendId(targetUserId, currentUserId)) {
            return FriendStatusDTO.builder()
                    .userId(targetUserId)
                    .status("ARE_FRIENDS")
                    .canSendRequest(false)
                    .build();
        }

        // Check if request exists
        // (We'll need to check this with friendRequestRepository)

        return FriendStatusDTO.builder()
                .userId(targetUserId)
                .status("NOT_FRIENDS")
                .canSendRequest(true)
                .build();
    }

    @Transactional
    public void unfriend(String friendId) {
        String currentUserId = getCurrentUserId();

        if (!friendshipRepository.existsByUserIdAndFriendId(currentUserId, friendId)) {
            throw new RuntimeException("You are not friends with this user");
        }

        friendshipRepository.deleteByUserIdAndFriendId(currentUserId, friendId);
        friendshipRepository.deleteByUserIdAndFriendId(friendId, currentUserId);
    }
}

