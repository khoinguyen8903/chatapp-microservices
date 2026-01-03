package com.chatapp.friend_service.repository;

import com.chatapp.friend_service.entity.FriendRequest;
import com.chatapp.friend_service.enums.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendRequestRepository extends JpaRepository<FriendRequest, String> {

    Optional<FriendRequest> findBySenderIdAndReceiverId(String senderId, String receiverId);

    List<FriendRequest> findByReceiverIdAndStatus(String receiverId, RequestStatus status);

    List<FriendRequest> findBySenderIdAndStatus(String senderId, RequestStatus status);

    void deleteById(String requestId);

    boolean existsBySenderIdAndReceiverId(String senderId, String receiverId);
}

