package com.chatapp.api_gateway.filter;


import com.chatapp.api_gateway.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.factory.AbstractGatewayFilterFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

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
            // 1. Kiểm tra xem route có nằm trong danh sách cần bảo mật không
            // (Nếu là login/register thì validator.isSecured trả về false -> bỏ qua if này)
            if (validator.isSecured.test(exchange.getRequest())) {

                // 2. Kiểm tra header Authorization có tồn tại không
                if (!exchange.getRequest().getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                    return onError(exchange, "Missing Authorization Header", HttpStatus.UNAUTHORIZED);
                }

                String authHeader = exchange.getRequest().getHeaders().get(HttpHeaders.AUTHORIZATION).get(0);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    authHeader = authHeader.substring(7);
                }

                try {
                    // 3. Validate Token (Nếu sai sẽ ném Exception)
                    jwtUtil.validateToken(authHeader);

                    // 4. Lấy UserId từ token
                    String userId = jwtUtil.extractUserId(authHeader);

                    // 5. Quan trọng: Gắn UserId vào Header để Chat Service biết ai đang gọi
                    // Chat Service sẽ lấy header này bằng cách: request.getHeader("X-User-Id")
                    exchange.getRequest().mutate()
                            .header("X-User-Id", userId)
                            .build();

                } catch (Exception e) {
                    System.out.println("Invalid Token Access: " + e.getMessage());
                    return onError(exchange, "Unauthorized access", HttpStatus.UNAUTHORIZED);
                }
            }
            return chain.filter(exchange);
        });
    }

    // Hàm trả về lỗi 401 cho client
    private Mono<Void> onError(ServerWebExchange exchange, String err, HttpStatus httpStatus) {
        exchange.getResponse().setStatusCode(httpStatus);
        return exchange.getResponse().setComplete();
    }

    public static class Config {}
}