package com.chatapp.media_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.TimeZone;

@SpringBootApplication
public class MediaServiceApplication {

	public static void main(String[] args) {
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
		System.setProperty("user.timezone", "Asia/Ho_Chi_Minh");
		SpringApplication.run(MediaServiceApplication.class, args);
	}

}
