package com.chatapp.chat_service.enums;

public enum CallType {
    OFFER,          // Người gọi gửi lời mời (kèm SDP)
    ANSWER,         // Người nghe chấp nhận (kèm SDP)
    ICE_CANDIDATE,  // Trao đổi thông tin mạng (IP/Port)
    REJECT,         // Từ chối cuộc gọi
    HANGUP,         // Kết thúc cuộc gọi
    BUSY            // Người nghe đang bận
}