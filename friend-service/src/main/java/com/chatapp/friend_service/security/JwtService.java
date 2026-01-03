package com.chatapp.friend_service.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.Key;

@Slf4j
@Service
public class JwtService {

    private final Key key;
    private final String secretRaw;

    public JwtService(@Value("${jwt.secret}") String secret) {
        this.secretRaw = (secret != null) ? secret.trim() : "";
        this.key = Keys.hmacShaKeyFor(this.secretRaw.getBytes(StandardCharsets.UTF_8));
    }

    @PostConstruct
    public void printSecretDebug() {
        log.info("🔐 [FRIEND SERVICE] Secret Loaded. Length: {}", secretRaw.length());
    }

    public Jws<Claims> parseToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token);
    }

    public String extractUserId(String token) {
        return parseToken(token).getBody().getSubject();
    }

    public String extractUsername(String token) {
        return (String) parseToken(token).getBody().get("username");
    }

    public boolean validateToken(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException e) {
            log.error("Invalid JWT token: {}", e.getMessage());
            return false;
        }
    }
}

