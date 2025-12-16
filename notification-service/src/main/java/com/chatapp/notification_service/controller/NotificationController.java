package com.chatapp.notification_service.controller;

import com.chatapp.notification_service.service.FcmService;
import com.chatapp.notification_service.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private FcmService fcmService;

    @Autowired
    private NotificationService notificationService;

    @PostMapping("/token")
    public ResponseEntity<String> registerToken(@RequestBody Map<String, String> payload) {
        String userId = payload.get("userId");
        String token = payload.get("token");

        if (userId == null || token == null) {
            return ResponseEntity.badRequest().body("Thiếu userId hoặc token");
        }
        fcmService.saveToken(userId, token);
        return ResponseEntity.ok("Lưu token thành công!");
    }

    @PostMapping("/send")
    public ResponseEntity<String> sendNotification(@RequestBody Map<String, Object> request) {
        // [FIX] Dùng String.valueOf để tránh lỗi ép kiểu null
        String userId = String.valueOf(request.get("userId"));

        // Kiểm tra null an toàn ngay từ Controller
        String senderName = request.get("senderName") != null ? String.valueOf(request.get("senderName")) : "Tin nhắn mới";
        String body = request.get("body") != null ? String.valueOf(request.get("body")) : "";
        String roomId = request.get("roomId") != null ? String.valueOf(request.get("roomId")) : "";

        notificationService.sendChatNotification(userId, senderName, body, roomId);

        return ResponseEntity.ok("Đã gửi lệnh thông báo");
    }
}