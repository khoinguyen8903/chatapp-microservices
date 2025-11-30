package com.chatapp.auth_service.service;

import com.chatapp.auth_service.dto.LoginRequest;
import com.chatapp.auth_service.dto.LoginResponse;
import com.chatapp.auth_service.dto.RegisterRequest;
import com.chatapp.auth_service.entity.User;
import com.chatapp.auth_service.repository.UserRepository;
import com.chatapp.auth_service.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public String register(RegisterRequest req) {
        // Quay lại dùng logic kiểm tra cơ bản để tránh lỗi 500
        // Nếu cần IgnoreCase, ta sẽ xử lý sau khi hệ thống ổn định
        if (userRepository.existsByUsername(req.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        User user = User.builder()
                .username(req.getUsername())
                .password(passwordEncoder.encode(req.getPassword()))
                .displayName(req.getDisplayName() == null ? req.getUsername() : req.getDisplayName())
                .build();
        userRepository.save(user);
        return user.getId();
    }

    public LoginResponse login(LoginRequest req) {
        User user = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, user.getId(), user.getDisplayName());
    }

    // --- SỬA CHỖ NÀY: Dùng findByUsername cho an toàn ---
    public boolean existsByUsername(String username) {
        // Login dùng hàm này được -> thì Check User cũng phải dùng được!
        // .isPresent() trả về true nếu tìm thấy user, false nếu không.
        return userRepository.findByUsername(username).isPresent();
    }
}