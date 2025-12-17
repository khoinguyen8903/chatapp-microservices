package com.chatapp.chat_service.client;

import com.chatapp.chat_service.dto.UserDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

// Lưu ý: url có thể thay đổi tùy cấu hình docker của bạn (ví dụ: auth-service:8080)
@FeignClient(name = "auth-service", url = "${application.config.auth-service-url:http://auth-service:8081}")
public interface UserClient {
    @GetMapping("/api/users/{id}")
    UserDTO getUserById(@PathVariable("id") String id);
}