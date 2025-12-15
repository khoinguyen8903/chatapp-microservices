package com.chatapp.api_gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
// [QUAN TRỌNG] Nhớ thêm 2 dòng import này
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    @Bean
    // [QUAN TRỌNG] Đặt độ ưu tiên cao nhất để chạy trước Security
    @Order(Ordered.HIGHEST_PRECEDENCE)
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration corsConfig = new CorsConfiguration();

        // Chấp nhận mọi nguồn (cho phép cả IP LAN và localhost)
        corsConfig.addAllowedOriginPattern("*");

        corsConfig.setMaxAge(3600L);
        corsConfig.addAllowedMethod("*"); // GET, POST, PUT, DELETE, OPTIONS...
        corsConfig.addAllowedHeader("*"); // Authorization, Content-Type...
        corsConfig.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", corsConfig);

        return new CorsWebFilter(source);
    }
}