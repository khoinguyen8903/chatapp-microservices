package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.UserResponse;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users") // Đường dẫn chuẩn mà Chat Service đang gọi
public class UserController {

    @Autowired
    private UserRepository userRepository;

    // API lấy thông tin user theo ID
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        // Trả về DTO chứa username và fullName
        return ResponseEntity.ok(new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName() // Đảm bảo trong Entity User có field fullName và getter
        ));
    }
}