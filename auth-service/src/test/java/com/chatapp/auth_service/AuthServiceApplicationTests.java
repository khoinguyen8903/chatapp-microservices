package com.chatapp.auth_service;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

// Thêm tham số properties vào annotation @SpringBootTest để ép buộc TimeZone đúng
@SpringBootTest(properties = "spring.jpa.properties.hibernate.jdbc.time_zone=Asia/Ho_Chi_Minh")
class AuthServiceApplicationTests {

	@Test
	void contextLoads() {
	}

}