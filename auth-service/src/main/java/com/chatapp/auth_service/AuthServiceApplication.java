package com.chatapp.auth_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.util.TimeZone; // Import thư viện TimeZone

@SpringBootApplication
public class AuthServiceApplication {

	public static void main(String[] args) {
		// QUAN TRỌNG: Dòng này ép buộc toàn bộ ứng dụng sử dụng múi giờ chuẩn ngay lập tức
		// Nó sẽ ghi đè múi giờ Asia/Saigon của Windows trước khi kết nối Database
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
		System.setProperty("user.timezone", "Asia/Ho_Chi_Minh");

		SpringApplication.run(AuthServiceApplication.class, args);
	}

}