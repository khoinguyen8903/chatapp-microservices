package com.chatapp.auth_service.security;

import com.chatapp.auth_service.entity.User;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Slf4j
@Service
public class JwtService {

    private final Key key;
    private final long expirationMs;
    private final String secretRaw;

    // Constructor Injection từ file application.yml
    public JwtService(@Value("${jwt.secret}") String secret,
                      @Value("${jwt.expiration-ms}") long expirationMs) {

        // --- QUAN TRỌNG: Cắt bỏ khoảng trắng thừa ---
        // Nếu secret null thì gán rỗng để tránh NullPointer (dù ít khi xảy ra)
        this.secretRaw = (secret != null) ? secret.trim() : "";

        // Tạo Key từ chuỗi đã làm sạch
        this.key = Keys.hmacShaKeyFor(this.secretRaw.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    @PostConstruct
    public void printSecretDebug() {
        // Log độ dài để so sánh với Gateway. Nếu độ dài khác nhau -> Lệch Key.
        log.info("🔐 [AUTH SERVICE] Secret Loaded. Length: {}", secretRaw.length());
        log.info("🔐 [AUTH SERVICE] Secret First 3 chars: {}", secretRaw.substring(0, Math.min(secretRaw.length(), 3)));
    }

    public String generateToken(User user) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .setSubject(user.getId())
                .claim("username", user.getUsername())
                .claim("displayName", user.getDisplayName())
                .setIssuedAt(now)
                .setExpiration(exp)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public Jws<Claims> parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token);
    }
}