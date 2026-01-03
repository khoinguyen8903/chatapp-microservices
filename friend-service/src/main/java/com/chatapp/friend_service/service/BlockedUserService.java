package com.chatapp.friend_service.service;

import com.chatapp.friend_service.entity.BlockedUser;
import com.chatapp.friend_service.repository.BlockedUserRepository;
import com.chatapp.friend_service.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class BlockedUserService {

    private final BlockedUserRepository blockedUserRepository;
    private final FriendshipRepository friendshipRepository;

    private String getCurrentUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getPrincipal().toString();
    }

    @Transactional
    public void blockUser(String blockedUserId, String reason) {
        String blockerId = getCurrentUserId();

        // Check if already blocked
        if (blockedUserRepository.existsByBlockerIdAndBlockedId(blockerId, blockedUserId)) {
            throw new RuntimeException("User is already blocked");
        }

        // Create blocked user record
        BlockedUser blockedUser = BlockedUser.builder()
                .id(UUID.randomUUID().toString())
                .blockerId(blockerId)
                .blockedId(blockedUserId)
                .reason(reason)
                .build();

        blockedUserRepository.save(blockedUser);

        // Remove friendship if exists
        friendshipRepository.deleteByUserIdAndFriendId(blockerId, blockedUserId);
        friendshipRepository.deleteByUserIdAndFriendId(blockedUserId, blockerId);
    }

    @Transactional
    public void unblockUser(String blockedUserId) {
        String blockerId = getCurrentUserId();

        blockedUserRepository.deleteByBlockerIdAndBlockedId(blockerId, blockedUserId);
    }

    public List<BlockedUser> getBlockedUsers() {
        String userId = getCurrentUserId();
        return blockedUserRepository.findByBlockerId(userId);
    }
}

