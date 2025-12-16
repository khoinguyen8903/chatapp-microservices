package com.chatapp.chat_service.client;


import com.chatapp.chat_service.dto.NotificationRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

// "notification-service" là tên service bạn đặt trong eureka hoặc docker-compose
@FeignClient(name = "notification-service", url = "${application.config.notification-url}")
public interface NotificationClient {

    @PostMapping("/api/notifications/send")
    void sendNotification(@RequestBody NotificationRequest request);
}