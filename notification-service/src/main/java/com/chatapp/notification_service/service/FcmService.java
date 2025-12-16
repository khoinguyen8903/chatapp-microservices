package com.chatapp.notification_service.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import java.util.concurrent.TimeUnit;

@Service
public class FcmService {

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // Tiền tố cho key để dễ quản lý trong Redis
    private static final String REDIS_PREFIX = "user_fcm_token:";

    // 1. Lưu Token vào Redis (Key: UserId -> Value: Token)
    public void saveToken(String userId, String token) {
        String key = REDIS_PREFIX + userId;
        // Lưu token và set thời gian sống là 30 ngày (tùy chỉnh)
        redisTemplate.opsForValue().set(key, token, 30, TimeUnit.DAYS);
    }

    // 2. Lấy Token từ Redis ra
    public String getToken(String userId) {
        return redisTemplate.opsForValue().get(REDIS_PREFIX + userId);
    }

    // 3. Xóa Token (Khi logout)
    public void deleteToken(String userId) {
        redisTemplate.delete(REDIS_PREFIX + userId);
    }
}