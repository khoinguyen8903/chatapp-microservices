package com.chatapp.chat_service.model;

import com.fasterxml.jackson.annotation.JsonProperty; // 1. IMPORT THƯ VIỆN NÀY
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Document(collection = "chat_rooms")
public class ChatRoom {
    @Id
    private String id;
    private String chatId;

    private String senderId;
    private String recipientId;

    // --- [SỬA LỖI TẠI ĐÂY] ---
    // Ép buộc JSON trả về phải là "isGroup" chứ không được tự đổi thành "group"
    @JsonProperty("isGroup")
    private boolean isGroup;

    private String groupName;
    private String adminId;
    private List<String> memberIds;
    
    // --- [UNREAD MESSAGE PREVIEW FIELDS] ---
    private String lastMessage;           // Preview of the last message
    private Date lastMessageTimestamp;    // Timestamp of the last message
    
    // Transient field (not persisted in DB, calculated dynamically)
    @Transient
    private int unreadCount;
}