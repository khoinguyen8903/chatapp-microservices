package com.chatapp.chat_service.service;

import com.chatapp.chat_service.model.UserStatus;
import com.chatapp.chat_service.repository.UserStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;

@Service
public class UserStatusService {

    @Autowired private UserStatusRepository repository;

    public void saveUserOnline(String userId) {
        saveStatus(userId, "ONLINE");
    }

    public void saveUserOffline(String userId) {
        saveStatus(userId, "OFFLINE");
    }

    private void saveStatus(String userId, String status) {
        UserStatus userStatus = repository.findById(userId).orElse(new UserStatus());
        userStatus.setUserId(userId);
        userStatus.setStatus(status);
        userStatus.setLastSeen(new Date());
        repository.save(userStatus);
    }

    public UserStatus getUserStatus(String userId) {
        return repository.findById(userId).orElse(
                UserStatus.builder()
                        .userId(userId)
                        .status("OFFLINE")
                        .lastSeen(new Date()) // Nếu chưa từng online thì lấy giờ hiện tại
                        .build()
        );
    }
}
