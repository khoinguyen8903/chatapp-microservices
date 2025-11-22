package com.chatapp.api_gateway.filter; // Sửa thành tên package đầy đủ

import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.function.Predicate;

@Component
public class RouteValidator {

    /**
     * Danh sách các API mở (Public Endpoints).
     * Những đường dẫn này sẽ KHÔNG bị chặn bởi AuthenticationFilter.
     */
    public static final List<String> openApiEndpoints = List.of(
            "/api/auth/register",   // Đăng ký tài khoản
            "/api/auth/login",      // Đăng nhập lấy token
            "/eureka"               // Endpoint cho Eureka Client (nếu dùng)
    );

    /**
     * Predicate (Hàm kiểm tra logic) để xác định xem request có cần bảo mật không.
     * Logic: Nếu đường dẫn request KHÔNG chứa bất kỳ string nào trong list mở -> Cần bảo mật (return true).
     */
    public Predicate<ServerHttpRequest> isSecured =
            request -> openApiEndpoints
                    .stream()
                    .noneMatch(uri -> request.getURI().getPath().contains(uri));
}