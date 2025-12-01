package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.LoginRequest;
import com.chatapp.auth_service.dto.LoginResponse;
import com.chatapp.auth_service.dto.RegisterRequest;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService svc;

    public AuthController(AuthService svc) {
        this.svc = svc;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        String userId = svc.register(req);
        return ResponseEntity.ok().body("{\"userId\":\"" + userId + "\"}");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        LoginResponse res = svc.login(req);
        return ResponseEntity.ok(res);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        // As example, shows secured endpoint returning authenticated userId from principal
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return ResponseEntity.status(401).build();
        String userId = String.valueOf(auth.getPrincipal());
        return ResponseEntity.ok().body("{\"userId\":\"" + userId + "\"}");
    }

    // API kiểm tra user tồn tại & trả về ID (Dùng khi tìm kiếm để tạo chat mới)
    @GetMapping("/check/{username}")
    public ResponseEntity<?> checkUserExists(@PathVariable String username) {
        // Gọi hàm tìm user (trả về entity User đầy đủ)
        User user = svc.findUserByUsername(username);

        if (user != null) {
            // Trả về JSON: { "exists": true, "userId": "...", "username": "..." }
            return ResponseEntity.ok(Map.of(
                    "exists", true,
                    "userId", user.getId(),       // ID thật (UUID) để dùng cho Topic chat
                    "username", user.getUsername() // Tên chuẩn trong DB
            ));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User not found"));
        }
    }

    // --- MỚI THÊM: API lấy thông tin user theo ID ---
    // API này giúp Frontend đổi UUID (ví dụ: 56f9...) thành tên hiển thị (ví dụ: admin)
    @GetMapping("/users/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable String userId) {
        // Lưu ý: Đảm bảo AuthService đã có hàm findUserById
        User user = svc.findUserById(userId);

        if (user != null) {
            return ResponseEntity.ok(user);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
    }
}