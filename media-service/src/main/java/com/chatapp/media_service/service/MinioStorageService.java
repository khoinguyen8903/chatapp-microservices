package com.chatapp.media_service.service;


import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Service
public class MinioStorageService {

    private final MinioClient minioClient;

    @Value("${minio.bucket-name}")
    private String bucketName;

    // Constructor Injection để khởi tạo MinioClient
    public MinioStorageService(@Value("${minio.url}") String url,
                               @Value("${minio.access-key}") String accessKey,
                               @Value("${minio.secret-key}") String secretKey) {
        this.minioClient = MinioClient.builder()
                .endpoint(url)
                .credentials(accessKey, secretKey)
                .build();
    }

    public String uploadFileToMinio(MultipartFile file) {
        try {
            // 1. Tạo tên file unique để tránh trùng đè file cũ
            // Ví dụ: avatar.png -> 550e8400-e29b..._avatar.png
            String originalFilename = file.getOriginalFilename();
            String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFilename;

            // 2. Lấy input stream
            InputStream inputStream = file.getInputStream();

            // 3. Đẩy lên MinIO
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(uniqueFileName)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            // 4. Trả về tên file đã lưu (để lưu vào DB) hoặc URL đầy đủ
            // Ở đây ta trả về URL đầy đủ giả định bucket là public
            // Lưu ý: url của minio trong docker là "minio:9000", nhưng browser client
            // cần truy cập qua "localhost:9000". Bạn có thể cần xử lý string này tuỳ môi trường.
            return uniqueFileName;

        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi upload file lên MinIO: " + e.getMessage());
        }
    }

    // Helper lấy URL public (để controller dùng)
    public String getPublicUrl(String fileName) {
        // Trả về đường dẫn localhost để frontend truy cập được
        return "http://localhost:9000/" + bucketName + "/" + fileName;
    }
}