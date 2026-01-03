package com.chatapp.friend_service.repository;

import com.chatapp.friend_service.entity.Friendship;
import com.chatapp.friend_service.enums.FriendStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends JpaRepository<Friendship, String> {

    Optional<Friendship> findByUserIdAndFriendId(String userId, String friendId);

    List<Friendship> findByUserIdAndStatus(String userId, FriendStatus status);

    List<Friendship> findByFriendIdAndStatus(String friendId, FriendStatus status);

    void deleteByUserIdAndFriendId(String userId, String friendId);

    boolean existsByUserIdAndFriendId(String userId, String friendId);
}

