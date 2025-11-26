package com.chatapp.api_gateway.config;
 // Đổi package theo project của bạn

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
public class CorsConfig {

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration corsConfig = new CorsConfiguration();

        // 1. Cho phép các domain nào được gọi tới?
        // Khi dev thì để "*" hoặc "http://localhost:3000" (React/Vue mặc định)
        corsConfig.setAllowedOrigins(Arrays.asList("http://localhost:3000", "http://localhost:4200"));
        // Nếu muốn test thoải mái thì dùng: corsConfig.addAllowedOriginPattern("*");

        // 2. Cho phép các method nào?
        corsConfig.setMaxAge(3600L);
        corsConfig.addAllowedMethod("GET");
        corsConfig.addAllowedMethod("POST");
        corsConfig.addAllowedMethod("PUT");
        corsConfig.addAllowedMethod("DELETE");
        corsConfig.addAllowedMethod("OPTIONS");

        // 3. Cho phép các Header nào?
        corsConfig.addAllowedHeader("*"); // Cho phép tất cả (Authorization, Content-Type...)

        // 4. Có cho phép gửi Cookie/Auth không?
        corsConfig.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);

        return new CorsWebFilter(source);
    }
}
