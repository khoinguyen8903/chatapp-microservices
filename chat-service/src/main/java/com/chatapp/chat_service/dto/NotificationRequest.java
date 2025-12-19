package com.chatapp.chat_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationRequest {
    private String userId;      // ID người nhận (recipient)
    private String senderName;  // Tên người gửi - hiển thị trong notification title. Fallback: "Người lạ"
    private String body;        // Nội dung tin nhắn (đã xử lý rút gọn hoặc thay thế icon)
    private String roomId;      // ID phòng chat để xử lý logic Frontend
}