package com.chatapp.api_gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

public class ApiGatewaySecurityConfig {

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(ServerHttpSecurity.CorsSpec::disable)
                .authorizeExchange(exchanges -> exchanges


                        .pathMatchers("/api/auth/**", "/api/chat/**", "/ws/**").permitAll()

                        .pathMatchers("/eureka/**").permitAll()
                        .pathMatchers("/api/v1/media/**").permitAll()
                        .anyExchange().authenticated()
                );
        return http.build();
    }
}