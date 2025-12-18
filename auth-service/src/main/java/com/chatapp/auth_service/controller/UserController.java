package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.UpdateProfileRequest;
import com.chatapp.auth_service.dto.UserProfileResponse;
import com.chatapp.auth_service.dto.UserResponse;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.repository.UserRepository;
import com.chatapp.auth_service.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users") // Đường dẫn chuẩn mà Chat Service đang gọi
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuthService authService;

    // API lấy thông tin user theo ID
    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));

        // Trả về DTO chứa username, fullName và avatarUrl
        return ResponseEntity.ok(UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .avatarUrl(user.getAvatarUrl())
                .build());
    }

    // Get current user's profile
    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getCurrentUserProfile() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        
        String userId = String.valueOf(auth.getPrincipal());
        User user = authService.getProfile(userId);
        
        UserProfileResponse response = UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .bio(user.getBio())
                .avatarUrl(user.getAvatarUrl())
                .isActive(user.getIsActive())
                .build();
        
        return ResponseEntity.ok(response);
    }

    // Update current user's profile
    @PutMapping("/profile")
    public ResponseEntity<UserProfileResponse> updateCurrentUserProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return ResponseEntity.status(401).build();
        }
        
        String userId = String.valueOf(auth.getPrincipal());
        User updatedUser = authService.updateProfile(
                userId,
                request.getFullName(),
                request.getPhone(),
                request.getBio(),
                request.getAvatarUrl()
        );
        
        UserProfileResponse response = UserProfileResponse.builder()
                .id(updatedUser.getId())
                .username(updatedUser.getUsername())
                .fullName(updatedUser.getFullName())
                .email(updatedUser.getEmail())
                .phone(updatedUser.getPhone())
                .bio(updatedUser.getBio())
                .avatarUrl(updatedUser.getAvatarUrl())
                .isActive(updatedUser.getIsActive())
                .build();
        
        return ResponseEntity.ok(response);
    }

    // Get any user's profile by ID (public profile info)
    @GetMapping("/{id}/profile")
    public ResponseEntity<UserProfileResponse> getUserProfile(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + id));
        
        UserProfileResponse response = UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .bio(user.getBio())
                .avatarUrl(user.getAvatarUrl())
                .build();
        
        return ResponseEntity.ok(response);
    }
}