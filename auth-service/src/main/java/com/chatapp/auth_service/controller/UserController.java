package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.UpdateProfileRequest;
import com.chatapp.auth_service.dto.UserProfileResponse;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    // --- Helper function để lấy ID từ Security Context an toàn ---
    private String getAuthenticatedUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }

        Object principal = auth.getPrincipal();

        // Kiểm tra xem principal là Object User hay là String
        if (principal instanceof User) {
            return ((User) principal).getId();
        } else if (principal instanceof UserDetails) {
            // Trường hợp dùng UserDetails mặc định khác
            // Lưu ý: Nếu username không phải ID, logic này cần check lại tùy cấu hình JWT
            return ((UserDetails) principal).getUsername();
        } else {
            // Trường hợp Principal là String (thường là 'sub' trong JWT)
            return principal.toString();
        }
    }

    /**
     * GET /api/users/profile
     */
    @GetMapping("/profile")
    public ResponseEntity<UserProfileResponse> getCurrentUserProfile() {
        String userId = getAuthenticatedUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        System.out.println("🔍 Getting profile for User ID: " + userId); // Log để debug

        User user = authService.getProfile(userId);
        if (user == null) {
            System.err.println("❌ User not found in DB with ID: " + userId);
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(authService.mapToProfileResponse(user));
    }

    /**
     * PUT /api/users/profile
     */
    @PutMapping("/profile")
    public ResponseEntity<UserProfileResponse> updateCurrentUserProfile(
            @Valid @RequestBody UpdateProfileRequest request) {

        String userId = getAuthenticatedUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        User updatedUser = authService.updateProfile(
                userId,
                request.getFullName(),
                request.getPhone(),
                request.getBio(),
                request.getAvatarUrl()
        );

        return ResponseEntity.ok(authService.mapToProfileResponse(updatedUser));
    }

    /**
     * GET /api/users/{userId}/profile
     */
    @GetMapping("/{userId}/profile")
    public ResponseEntity<UserProfileResponse> getUserProfileById(@PathVariable String userId) {
        User user = authService.findUserById(userId);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(authService.mapToProfileResponse(user));
    }
}