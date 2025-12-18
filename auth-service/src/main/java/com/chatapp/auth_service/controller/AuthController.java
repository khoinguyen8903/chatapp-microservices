package com.chatapp.auth_service.controller;

import com.chatapp.auth_service.dto.LoginRequest;
import com.chatapp.auth_service.dto.LoginResponse;
import com.chatapp.auth_service.dto.RegisterRequest;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService svc;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

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

    // --- EMAIL VERIFICATION ENDPOINTS ---
    @GetMapping("/verify")
    public ResponseEntity<Void> verifyEmail(@RequestParam("token") String token) {
        System.out.println("🔗 Verification request received with token: " + token);
        
        try {
            svc.verifyEmail(token);
            
            // Success: redirect to frontend login page with verified=true
            String redirectUrl = frontendUrl + "/login?verified=true";
            System.out.println("✅ Email verified successfully. Redirecting to: " + redirectUrl);
            
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirectUrl))
                    .build();
                    
        } catch (IllegalArgumentException e) {
            // Failure: redirect to frontend login page with error parameter
            String redirectUrl = frontendUrl + "/login?error=verification_failed";
            System.err.println("❌ Email verification failed: " + e.getMessage());
            System.err.println("   Redirecting to: " + redirectUrl);
            
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirectUrl))
                    .build();
        } catch (Exception e) {
            // Catch any unexpected errors
            String redirectUrl = frontendUrl + "/login?error=verification_failed";
            System.err.println("❌ Unexpected error during verification: " + e.getMessage());
            e.printStackTrace();
            System.err.println("   Redirecting to: " + redirectUrl);
            
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(redirectUrl))
                    .build();
        }
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerificationEmail(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            if (email == null || email.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
            }
            svc.resendVerificationEmail(email);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Verification email resent successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", e.getMessage()
            ));
        }
    }
}