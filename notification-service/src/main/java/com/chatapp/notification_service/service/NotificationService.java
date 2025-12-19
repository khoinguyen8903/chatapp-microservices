package com.chatapp.notification_service.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.FirebaseMessagingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    @Autowired
    private FcmService fcmService;

    public void sendChatNotification(String recipientId, String senderName, String messageContent, String roomId) {
        String token = fcmService.getToken(recipientId);

        if (token != null) {
            try {
                // [FIX NULL POINTER EXCEPTION & UPDATED FALLBACK]
                // Firebase .putData() KHÔNG CHẤP NHẬN NULL -> Phải kiểm tra
                // Fallback to "Người lạ" (Stranger) for consistency with ChatMessageService
                String safeSenderName = (senderName != null && !senderName.trim().isEmpty()) ? senderName : "Người lạ";
                String safeBody = (messageContent != null) ? messageContent : "Bạn có tin nhắn";
                String safeRoomId = (roomId != null) ? roomId : "";

                Message message = Message.builder()
                        .setToken(token)
                        .putData("type", "chat_msg")
                        .putData("username", safeSenderName)  // Actual sender's name
                        .putData("title", safeSenderName)      // Display sender's name as notification title
                        .putData("body", safeBody)
                        .putData("roomId", safeRoomId)
                        .build();

                String response = FirebaseMessaging.getInstance().send(message);
                System.out.println(">> Đã gửi Data-Message tới user " + recipientId + " (from: " + safeSenderName + "): " + response);

            } catch (FirebaseMessagingException e) {
                e.printStackTrace();
                System.err.println("Lỗi gửi Firebase: " + e.getMessage());
            } catch (Exception e) {
                // Bắt thêm Exception chung để tránh sập app vì lý do khác
                e.printStackTrace();
            }
        } else {
            System.out.println("User " + recipientId + " không có token.");
        }
    }
}