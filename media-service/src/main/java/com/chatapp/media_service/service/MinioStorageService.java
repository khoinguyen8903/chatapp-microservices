package com.chatapp.media_service.service;

import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.http.Method;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class MinioStorageService {

    private final MinioClient internalClient; // Dùng để Upload (mạng nội bộ Docker)
    private final MinioClient publicClient;   // Dùng để tạo Link (cho trình duyệt bên ngoài)

    @Value("${minio.bucket-name}")
    private String bucketName;

    public MinioStorageService(@Value("${minio.url}") String internalUrl,
                               @Value("${minio.access-key}") String accessKey,
                               @Value("${minio.secret-key}") String secretKey) {

        // 1. Client nội bộ: Kết nối đến "http://minio:9000"
        this.internalClient = MinioClient.builder()
                .endpoint(internalUrl)
                .credentials(accessKey, secretKey)
                .build();

        // 2. Client công khai: Cấu hình giả lập là "http://localhost:9000"
        // Mục đích: Để chữ ký sinh ra khớp với trình duyệt của người dùng.
        // QUAN TRỌNG: Phải set region("us-east-1") để nó không cố kết nối mạng (nếu kết nối sẽ lỗi vì container ko thấy localhost)
        this.publicClient = MinioClient.builder()
                .endpoint("http://localhost:9000") // Khi deploy thì thay bằng IP Server/Domain
                .region("us-east-1") // Bắt buộc dòng này để tránh lỗi kết nối mạng nội bộ
                .credentials(accessKey, secretKey)
                .build();
    }

    public String uploadFileToMinio(MultipartFile file) {
        try {
            String originalFilename = file.getOriginalFilename();
            String uniqueFileName = UUID.randomUUID().toString() + "_" + originalFilename.replaceAll("\\s+", "_");

            InputStream inputStream = file.getInputStream();

            // Upload dùng internalClient (kết nối thật trong Docker)
            internalClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(uniqueFileName)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            return uniqueFileName;

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Lỗi upload MinIO: " + e.getMessage());
        }
    }

    public String getPublicUrl(String fileName) {
        try {
            Map<String, String> reqParams = new HashMap<>();
            reqParams.put("response-content-disposition", "attachment; filename=\"" + fileName + "\"");

            // Tạo link dùng publicClient (để link sinh ra là localhost:9000)
            return publicClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(fileName)
                            .expiry(7, TimeUnit.DAYS)
                            .extraQueryParams(reqParams)
                            .build()
            );
        } catch (Exception e) {
            System.err.println("Lỗi tạo URL: " + e.getMessage());
            return "http://localhost:9000/" + bucketName + "/" + fileName;
        }
    }
}