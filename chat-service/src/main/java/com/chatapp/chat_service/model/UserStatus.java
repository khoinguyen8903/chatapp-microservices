package com.chatapp.chat_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "user_status")
public class UserStatus {
    @Id
    private String userId; // ID của user (UUID)
    private String status; // "ONLINE" hoặc "OFFLINE"
    private Date lastSeen; // Thời gian cuối cùng online
}