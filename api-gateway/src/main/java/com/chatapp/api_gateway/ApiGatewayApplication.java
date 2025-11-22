package com.chatapp.api_gateway; // <--- SỬA THÀNH CHATAPP

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan; // Thêm ComponentScan để đảm bảo quét các Filter

@SpringBootApplication
// Thêm ComponentScan để quét tất cả các subpackage (filter, util)
@ComponentScan(basePackages = "com.chatapp.api_gateway")
public class ApiGatewayApplication {
	public static void main(String[] args) {
		SpringApplication.run(ApiGatewayApplication.class, args);
	}
}