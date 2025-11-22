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
        // Log ra để bạn so sánh với log của Auth Service
        log.info("🔐 [API GATEWAY] Secret Loaded: {}", secret);

        // Tạo key signing từ secret
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public void validateToken(final String token) {
        // Sử dụng key đã khởi tạo sẵn
        Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token);
    }

    public String extractUserId(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key) // Sử dụng key đã khởi tạo
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}