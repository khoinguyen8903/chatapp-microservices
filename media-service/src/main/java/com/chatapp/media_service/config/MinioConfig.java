package com.chatapp.media_service.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

    @Value("${minio.url}")
    private String minioUrl;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        try {
            // 1. Khởi tạo Client
            MinioClient client = MinioClient.builder()
                    .endpoint(minioUrl)
                    .credentials(accessKey, secretKey)
                    .build();

            // 2. Kiểm tra kết nối NGAY LẬP TỨC tại đây
            // Nếu không kết nối được, nó sẽ ném lỗi ngay, không cho ứng dụng khởi động sai.
            client.listBuckets();

            System.out.println("✅ ==================================================");
            System.out.println("✅ MinIO Connected Successfully to: " + minioUrl);
            System.out.println("✅ ==================================================");

            return client;
        } catch (Exception e) {
            System.err.println("❌ ==================================================");
            System.err.println("❌ Failed to connect to MinIO at " + minioUrl);
            System.err.println("❌ Error: " + e.getMessage());
            System.err.println("❌ ==================================================");
            // Ném lỗi Runtime để dừng server nếu config sai
            throw new RuntimeException("MinIO connection failed", e);
        }
    }
}