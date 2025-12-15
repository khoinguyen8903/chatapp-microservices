package com.chatapp.chat_service.enums;

public enum MessageStatus {
    SENT,       // Đã gửi (Server đã nhận và lưu DB)
    DELIVERED,  // Đã nhận (Máy người nhận đã nhận được tin)
    SEEN        // Đã xem (Người nhận đã mở khung chat)
}