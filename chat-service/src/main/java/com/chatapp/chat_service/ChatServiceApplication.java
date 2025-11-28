package com.chatapp.chat_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
// Thêm 2 dòng import này
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.security.reactive.ReactiveSecurityAutoConfiguration;

// SỬA DÒNG NÀY (Thêm exclude):
@SpringBootApplication(exclude = {
		SecurityAutoConfiguration.class,
		ReactiveSecurityAutoConfiguration.class
})
public class ChatServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(ChatServiceApplication.class, args);
	}
}