package com.chatapp.api_gateway.filter;

import com.chatapp.api_gateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

                if (!exchange.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    return onError(exchange, "Missing Authorization Header", HttpStatus.UNAUTHORIZED);
                }

                String authHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    authHeader = authHeader.substring(7);
                } else {
                    return onError(exchange, "Invalid Authorization format (Must be Bearer <token>)", HttpStatus.UNAUTHORIZED);
                }

                try {
                    // 3. Validate Token (Nếu sai sẽ ném Exception)
                    jwtUtil.validateToken(authHeader);

                    // 4. Lấy UserId từ token
                    String userId = jwtUtil.extractUserId(authHeader);

                    // 5. Quan trọng: Gắn UserId vào Header để Chat Service biết ai đang gọi
                    exchange.getRequest().mutate()
                            .header("X-User-Id", userId)
                            .build();

                } catch (Exception e) {
                    System.out.println("Invalid Token Access: " + e.getMessage());
                    // TRẢ VỀ LỖI CÓ BODY, CUNG CẤP LÝ DO RÕ RÀNG
                    return onError(exchange, "Invalid Token: " + e.getMessage(), HttpStatus.UNAUTHORIZED);
                }
            }
            return chain.filter(exchange);
        });
    }

    // HÀM SỬA LỖI: Trả về Response 401 CÓ Body JSON
    private Mono<Void> onError(ServerWebExchange exchange, String err, HttpStatus httpStatus) {
        exchange.getResponse().setStatusCode(httpStatus);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);

        // Tạo body JSON chứa thông báo lỗi
        String responseBody = "{\"status\": " + httpStatus.value()
                + ", \"error\": \"" + httpStatus.getReasonPhrase()
                + "\", \"message\": \"" + err + "\"}";

        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(responseBody.getBytes(StandardCharsets.UTF_8));

        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    public static class Config {}
}