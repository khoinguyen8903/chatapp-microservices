package com.chatapp.friend_service.service;

import com.chatapp.friend_service.client.AuthClient;
import com.chatapp.friend_service.dto.RecommendationDTO;
import com.chatapp.friend_service.dto.UserDTO;
import com.chatapp.friend_service.entity.FriendRequest;
import com.chatapp.friend_service.repository.BlockedUserRepository;
import com.chatapp.friend_service.repository.FriendRequestRepository;
import com.chatapp.friend_service.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final FriendshipRepository friendshipRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final AuthClient authClient;

    private String getCurrentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
    }

    public List<RecommendationDTO> getRecommendations() {
        String currentUserId = getCurrentUserId();

        // Get current user's friends
        var friendships = friendshipRepository.findByUserIdAndStatus(
                currentUserId, com.chatapp.friend_service.enums.FriendStatus.ACCEPTED
        );

        // Get IDs of users that are already friends or have pending requests
        Set<String> excludedUserIds = new HashSet<>();
        excludedUserIds.add(currentUserId); // Exclude self

        friendships.forEach(f -> {
            excludedUserIds.add(f.getFriendId());
        });

        // Get pending requests
        List<FriendRequest> sentRequests = friendRequestRepository.findBySenderIdAndStatus(
                currentUserId, com.chatapp.friend_service.enums.RequestStatus.PENDING
        );
        sentRequests.forEach(r -> excludedUserIds.add(r.getReceiverId()));

        List<FriendRequest> receivedRequests = friendRequestRepository.findByReceiverIdAndStatus(
                currentUserId, com.chatapp.friend_service.enums.RequestStatus.PENDING
        );
        receivedRequests.forEach(r -> excludedUserIds.add(r.getSenderId()));

        // Get blocked users
        var blockedUsers = blockedUserRepository.findByBlockerId(currentUserId);
        blockedUsers.forEach(b -> excludedUserIds.add(b.getBlockedId()));

        // Get friends of friends (for mutual friends)
        Set<String> friendsOfFriends = new HashSet<>();
        friendships.forEach(f -> {
            var friendFriends = friendshipRepository.findByUserIdAndStatus(
                    f.getFriendId(), com.chatapp.friend_service.enums.FriendStatus.ACCEPTED
            );
            friendFriends.forEach(ff -> {
                if (!excludedUserIds.contains(ff.getFriendId())) {
                    friendsOfFriends.add(ff.getFriendId());
                }
            });
        });

        // Convert to recommendation DTOs
        List<RecommendationDTO> recommendations = friendsOfFriends.stream()
                .limit(10) // Limit to 10 recommendations
                .map(userId -> {
                    try {
                        var userResponse = authClient.getUserById(userId);
                        var userDTO = userResponse.toUserDTO();

                        return RecommendationDTO.builder()
                                .user(userDTO)
                                .mutualFriends(List.of()) // Could calculate actual mutual friends
                                .reason("Friend of a friend")
                                .build();
                    } catch (Exception e) {
                        log.error("Failed to fetch user info: {}", userId, e);
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        return recommendations;
    }

    public List<UserDTO> searchUsers(String keyword) {
        try {
            // For now, return empty list as search is handled by auth-service
            // This is a placeholder for future implementation
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Error searching users", e);
            return Collections.emptyList();
        }
    }
}

