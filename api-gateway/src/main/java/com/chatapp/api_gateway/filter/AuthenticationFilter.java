package com.chatapp.api_gateway.filter;

import com.chatapp.api_gateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;

@Component
public class AuthenticationFilter extends AbstractGatewayFilterFactory<AuthenticationFilter.Config> {

    @Autowired
    private RouteValidator validator;
    @Autowired
    private JwtUtil jwtUtil;

    public AuthenticationFilter() {
        super(Config.class);
    }

    @Override
    public GatewayFilter apply(Config config) {
        return ((exchange, chain) -> {
            if (validator.isSecured.test(exchange.getRequest())) {

                String authHeader = null;

                // 1. Ưu tiên tìm Token trong Header (Dành cho API REST thường)
                if (exchange.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    String rawHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
                    if (rawHeader != null && rawHeader.startsWith("Bearer ")) {
                        authHeader = rawHeader.substring(7);
                    }
                }
                // 2. [FIX QUAN TRỌNG] Nếu không có Header, tìm trong Query Param (Dành cho WebSocket)
                // URL sẽ dạng: ws://.../ws?token=eyJhbGci...
                else if (exchange.getRequest().getQueryParams().containsKey("token")) {
                    authHeader = exchange.getRequest().getQueryParams().getFirst("token");
                    // System.out.println("🔍 [GATEWAY] Found Token in Query Param for WebSocket");
                }

                // Nếu tìm cả 2 nơi đều không thấy -> Lỗi
                if (authHeader == null) {
                    return onError(exchange, "Missing Authorization (Header or Query Param)", HttpStatus.UNAUTHORIZED);
                }

                try {
                    // 3. Validate Token
                    jwtUtil.validateToken(authHeader);

                    // 4. Trích xuất ID và Tên
                    String userId = jwtUtil.extractUserId(authHeader);
                    String username = jwtUtil.extractUsername(authHeader);

                    // Log kiểm tra xem Gateway đã lấy được tên chưa
                    System.out.println("🚀 GATEWAY_SENDING_NAME: " + username + " (userId: " + userId + ")");

                    // 5. Gắn Header vào Request để gửi xuống Chat Service
                    // Chat Service sẽ đọc header này trong lúc Handshake
                    ServerHttpRequest request = exchange.getRequest().mutate()
                            .header("X-User-Id", userId)
                            .header("X-User-Name", username)
                            .build();

                    ServerWebExchange mutatedExchange = exchange.mutate().request(request).build();
                    return chain.filter(mutatedExchange);

                } catch (Exception e) {
                    System.err.println("❌ Invalid Token Access: " + e.getMessage());
                    return onError(exchange, "Invalid Token: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
                }
            }

            return chain.filter(exchange);
        });
    }

    private Mono<Void> onError(ServerWebExchange exchange, String err, HttpStatus httpStatus) {
        exchange.getResponse().setStatusCode(httpStatus);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String responseBody = "{\"status\": " + httpStatus.value() + ", \"message\": \"" + err + "\"}";
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(responseBody.getBytes(StandardCharsets.UTF_8));
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    public static class Config {}
}