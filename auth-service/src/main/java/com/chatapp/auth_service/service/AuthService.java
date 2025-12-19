package com.chatapp.auth_service.service;

import com.chatapp.auth_service.dto.LoginRequest;
import com.chatapp.auth_service.dto.LoginResponse;
import com.chatapp.auth_service.dto.RegisterRequest;
import com.chatapp.auth_service.dto.UserProfileResponse;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.repository.UserRepository;
import com.chatapp.auth_service.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }

    @Transactional
    public String register(RegisterRequest req) {
        // Kiểm tra tồn tại trước khi đăng ký
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }

        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Generate verification token
        String verificationToken = UUID.randomUUID().toString();

        User user = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getDisplayName() == null ? req.getUsername() : req.getDisplayName())
                .email(req.getEmail())
                .isActive(false) // User is not active until email is verified
                .verificationToken(verificationToken)
                .build();
        userRepository.save(user);

        // Send verification email asynchronously
        emailService.sendVerificationEmail(user.getEmail(), verificationToken, user.getUsername());

        return user.getId();
    }

    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        // Check if email is verified
        if (!user.getIsActive()) {
            throw new IllegalArgumentException("Please verify your email before logging in");
        }

        String token = jwtService.generateToken(user);
        return LoginResponse.builder()
                .token(token)
                .userId(user.getId())
                .fullName(user.getFullName())
                .username(user.getUsername())
                .email(user.getEmail())
                .build();
    }

    // Hàm kiểm tra tồn tại (Trả về true/false)
    public boolean existsByUsername(String username) {
        return userRepository.findByUsername(username).isPresent();
    }

    // Hàm tìm user theo username (trả về User)
    public User findUserByUsername(String username) {
        return userRepository.findByUsername(username).orElse(null);
    }

    // --- MỚI THÊM: Tìm user theo ID (Để frontend hiển thị tên thay vì UUID) ---
    public User findUserById(String userId) {
        return userRepository.findById(userId).orElse(null);
    }

    // Email verification
    @Transactional
    public boolean verifyEmail(String token) {
        System.out.println("🔍 Verifying email with token: " + token);

        User user = userRepository.findByVerificationToken(token)
                .orElseThrow(() -> {
                    System.err.println("❌ Invalid verification token: " + token);
                    return new IllegalArgumentException("Invalid verification token");
                });

        System.out.println("👤 Found user: " + user.getUsername() + " (Current active status: " + user.getIsActive() + ")");

        if (user.getIsActive()) {
            System.out.println("⚠️ Email already verified for user: " + user.getUsername());
            throw new IllegalArgumentException("Email already verified");
        }

        // Set user as active and clear verification token
        user.setIsActive(true);
        user.setVerificationToken(null);

        // CRITICAL: Save the user to persist changes to database
        User savedUser = userRepository.save(user);

        System.out.println("✅ User verified and saved successfully: " + savedUser.getUsername() + " (New active status: " + savedUser.getIsActive() + ")");

        // Send welcome email asynchronously
        emailService.sendWelcomeEmail(savedUser.getEmail(), savedUser.getUsername());

        return true;
    }

    // Resend verification email
    @Transactional
    public void resendVerificationEmail(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Email not found"));

        if (user.getIsActive()) {
            throw new IllegalArgumentException("Email already verified");
        }

        // Generate new token
        String newToken = UUID.randomUUID().toString();
        user.setVerificationToken(newToken);
        userRepository.save(user);

        // Resend email
        emailService.sendVerificationEmail(user.getEmail(), newToken, user.getUsername());
    }

    // Profile Management
    @Transactional
    public User updateProfile(String userId, String fullName, String phone, String bio, String avatarUrl) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (fullName != null && !fullName.isEmpty()) {
            user.setFullName(fullName);
        }
        if (phone != null) {
            user.setPhone(phone);
        }
        if (bio != null) {
            user.setBio(bio);
        }
        if (avatarUrl != null) {
            user.setAvatarUrl(avatarUrl);
        }

        return userRepository.save(user);
    }

    public User getProfile(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    /**
     * Helper method to map User entity to UserProfileResponse DTO
     * This prevents Jackson circular reference issues
     */
    public UserProfileResponse mapToProfileResponse(User user) {
        if (user == null) {
            return null;
        }

        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .bio(user.getBio())
                .avatarUrl(user.getAvatarUrl())
                .isActive(user.getIsActive())
                .build();
    }
}