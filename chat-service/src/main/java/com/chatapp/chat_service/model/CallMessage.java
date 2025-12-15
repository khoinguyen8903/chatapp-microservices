package com.chatapp.chat_service.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CallMessage {
    private String senderId;
    private String senderName;  // Để hiển thị "Nguyễn Văn A đang gọi..."
    private String recipientId; // UserID (nếu gọi 1-1) hoặc GroupID (nếu gọi nhóm)
    private com.chatapp.chat_service.model.CallType type;

    // Chứa dữ liệu WebRTC (SDP hoặc ICE Candidate)
    // Dùng Map<String, Object> để linh hoạt, vì SDP và ICE có cấu trúc JSON khác nhau
    private Map<String, Object> data;

    private boolean isGroup;    // Cờ đánh dấu gọi nhóm
}