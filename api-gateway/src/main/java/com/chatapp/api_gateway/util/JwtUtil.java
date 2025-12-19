package com.chatapp.api_gateway.util;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.function.Function;

@Slf4j
@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secret;

    private Key key;

    // Khởi tạo Key MỘT LẦN DUY NHẤT khi Bean được tạo
    @PostConstruct
    public void init() {
        if (secret == null) {
            throw new RuntimeException("JWT Secret is null! Check application.yml");
        }

        // --- QUAN TRỌNG: Cắt bỏ khoảng trắng thừa ---
        String cleanSecret = secret.trim();

        // Log độ dài để so sánh với Auth Service
        log.info("🔐 [API GATEWAY] Secret Loaded. Length: {}", cleanSecret.length());
        log.info("🔐 [API GATEWAY] Secret First 3 chars: {}", cleanSecret.substring(0, Math.min(cleanSecret.length(), 3)));

        // Tạo key signing từ secret đã làm sạch
        this.key = Keys.hmacShaKeyFor(cleanSecret.getBytes(StandardCharsets.UTF_8));
    }

    public void validateToken(final String token) {
        // Sử dụng key đã khởi tạo sẵn để kiểm tra chữ ký
        // Nếu chữ ký sai, nó sẽ ném SignatureException -> AuthenticationFilter sẽ bắt được
        Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }

    public String extractUserId(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * Extracts the username (full name) from the JWT token.
     * This is used to pass the user's name to downstream services via X-User-Name header.
     * Tries multiple claim names for compatibility with different JWT issuers (Firebase, OIDC, custom).
     */
    public String extractUsername(String token) {
        Claims claims = extractAllClaims(token);
        
        // Try multiple claim names in order of preference
        String[] claimNames = {"fullName", "name", "username", "preferred_username", "nickname"};
        
        for (String claimName : claimNames) {
            String value = claims.get(claimName, String.class);
            if (value != null && !value.trim().isEmpty()) {
                log.info("🔍 [JWT] Extracted username from claim '{}': {}", claimName, value);
                return value;
            }
        }
        
        // Last resort: return subject (user ID)
        String subject = claims.getSubject();
        log.warn("⚠️ [JWT] No name claims found in token, falling back to subject: {}", subject);
        return subject;
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}