package com.chatapp.api_gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration corsConfig = new CorsConfiguration();

        // --- SỬA Ở ĐÂY ---
        // Thay vì liệt kê cụ thể, hãy dùng Pattern "*" để chấp nhận MỌI nguồn
        // Bao gồm cả http://127.0.0.1:5500 hay file://...
        corsConfig.addAllowedOriginPattern("*");

        // Các phần dưới giữ nguyên
        corsConfig.setMaxAge(3600L);
        corsConfig.addAllowedMethod("*"); // Cho phép mọi Method (GET, POST, PUT, DELETE...)
        corsConfig.addAllowedHeader("*"); // Cho phép mọi Header
        corsConfig.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);

        return new CorsWebFilter(source);
    }
}