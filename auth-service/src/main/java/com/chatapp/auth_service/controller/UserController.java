package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.UpdateProfileRequest;
import com.chatapp.auth_service.dto.UserProfileResponse;
import com.chatapp.auth_service.dto.UserResponse;
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
     * GET /api/users/{userId}
     * Public endpoint for service-to-service calls (used by chat-service via Feign client)
     * Returns basic user info (id, username, fullName, avatarUrl) compatible with UserDTO
     * NOTE: This must be declared BEFORE /{userId}/profile to avoid path mapping conflicts
     */
    @GetMapping(value = "/{userId}", headers = "Accept=application/json")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String userId) {
        try {
            System.out.println("🔍 [UserController] GET /api/users/" + userId + " - Service-to-service call");
            User user = authService.findUserById(userId);
            if (user == null) {
                System.out.println("❌ [UserController] User not found: " + userId);
                return ResponseEntity.notFound().build();
            }
            
            // Create UserResponse using constructor (safer than builder with @AllArgsConstructor)
            UserResponse response = new UserResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getFullName(),
                    user.getAvatarUrl()
            );
            
            System.out.println("✅ [UserController] Returning user: " + user.getUsername());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("❌ [UserController] Error in getUserById for userId: " + userId);
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
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

    /**
     * GET /api/users/search?keyword=...
     * Search users by username or email (for add member feature)
     * Returns list of UserResponse objects (id, username, fullName, avatarUrl)
     */
    @GetMapping("/search")
    public ResponseEntity<java.util.List<UserResponse>> searchUsers(@RequestParam("keyword") String keyword) {
        try {
            if (keyword == null || keyword.trim().isEmpty()) {
                return ResponseEntity.ok(new java.util.ArrayList<>());
            }

            java.util.List<User> users = authService.searchUsers(keyword);
            java.util.List<UserResponse> responses = users.stream()
                    .map(user -> new UserResponse(
                            user.getId(),
                            user.getUsername(),
                            user.getFullName(),
                            user.getAvatarUrl()
                    ))
                    .collect(java.util.stream.Collectors.toList());

            return ResponseEntity.ok(responses);
        } catch (Exception e) {
            System.err.println("❌ [UserController] Error searching users: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).build();
        }
    }
}