package com.chatapp.chat_service.repository;

import com.chatapp.chat_service.model.UserStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserStatusRepository extends MongoRepository<UserStatus, String> {
}