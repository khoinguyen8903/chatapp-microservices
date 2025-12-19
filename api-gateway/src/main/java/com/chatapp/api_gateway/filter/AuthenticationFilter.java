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
            // 1. Kiểm tra xem Route này có cần bảo mật không (dựa vào RouteValidator)
            if (validator.isSecured.test(exchange.getRequest())) {

                // 2. Kiểm tra Header Authorization có tồn tại không
                if (!exchange.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    return onError(exchange, "Missing Authorization Header", HttpStatus.UNAUTHORIZED);
                }

                // 3. Lấy Token từ Header
                String authHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    authHeader = authHeader.substring(7);
                } else {
                    return onError(exchange, "Invalid Authorization format (Must be Bearer <token>)", HttpStatus.UNAUTHORIZED);
                }

                try {
                    // 4. Validate Token (Nếu token hết hạn hoặc sai chữ ký sẽ ném Exception)
                    jwtUtil.validateToken(authHeader);

                    // 5. Lấy UserId từ trong Token ra
                    String userId = jwtUtil.extractUserId(authHeader);

                    // =================================================================
                    // [QUAN TRỌNG - ĐÃ SỬA LỖI]
                    // Trong WebFlux, Request là bất biến (Immutable).
                    // Ta phải tạo bản sao (mutate), gắn header vào, rồi tạo Exchange mới.
                    // =================================================================

                    ServerHttpRequest request = exchange.getRequest().mutate()
                            .header("X-User-Id", userId) // Gửi ID này xuống Media/Chat Service
                            .build();

                    ServerWebExchange mutatedExchange = exchange.mutate().request(request).build();

                    // Chuyền Exchange MỚI (đã có header) đi tiếp
                    return chain.filter(mutatedExchange);

                } catch (Exception e) {
                    System.err.println("❌ Invalid Token Access: " + e.getMessage());
                    // Trả về lỗi JSON đẹp cho Frontend
                    return onError(exchange, "Invalid Token: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
                }
            }

            // Nếu route không cần bảo mật (ví dụ /auth/login), cứ thế đi tiếp
            return chain.filter(exchange);
        });
    }

    // Hàm trả về lỗi dạng JSON để Frontend dễ xử lý
    private Mono<Void> onError(ServerWebExchange exchange, String err, HttpStatus httpStatus) {
        exchange.getResponse().setStatusCode(httpStatus);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String responseBody = "{\"status\": " + httpStatus.value()
                + ", \"error\": \"" + httpStatus.getReasonPhrase()
                + "\", \"message\": \"" + err + "\"}";

        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(responseBody.getBytes(StandardCharsets.UTF_8));

        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    public static class Config {
        // Có thể thêm config nếu cần thiết
    }
}