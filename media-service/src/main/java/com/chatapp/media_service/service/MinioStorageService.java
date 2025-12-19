package com.chatapp.media_service.service;

import com.chatapp.media_service.entity.MediaFile;
import com.chatapp.media_service.repository.MediaFileRepository;
import io.minio.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class MinioStorageService { // Tên Class giữ nguyên

    // Inject Bean đã tạo ở MinioConfig
    private final MinioClient minioClient;
    private final MediaFileRepository mediaFileRepository; // Tên biến Repository chuẩn

    @Value("${minio.bucket-name}")
    private String bucketName;

    @Value("${minio.public-url}")
    private String minioPublicUrl;

    // [SỬA] Tên Constructor phải trùng tên Class (MinioStorageService)
    // [SỬA] Tham số phải là MediaFileRepository để khớp với biến ở trên
    public MinioStorageService(MinioClient minioClient, MediaFileRepository mediaFileRepository) {
        this.minioClient = minioClient;
        this.mediaFileRepository = mediaFileRepository;
    }

    public MediaFile uploadFile(MultipartFile file, String uploaderId) {
        try {
            // 1. Kiểm tra Bucket, nếu chưa có thì tạo và set Public
            boolean found = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build());
            if (!found) {
                System.out.println("🔧 Bucket '" + bucketName + "' not found. Creating...");
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());

                // Tạo Policy Public Read
                String policyJson = buildPublicReadPolicy(bucketName);
                minioClient.setBucketPolicy(
                        SetBucketPolicyArgs.builder().bucket(bucketName).config(policyJson).build()
                );
                System.out.println("✅ Bucket created and set to Public Read.");
            }

            // 2. Tạo tên file unique
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            // Dùng UUID để tránh trùng tên
            String fileName = UUID.randomUUID().toString() + extension;

            // 3. Upload file lên MinIO
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucketName)
                            .object(fileName)
                            .stream(file.getInputStream(), file.getSize(), -1)
                            .contentType(file.getContentType())
                            .build()
            );

            // 4. Tạo Public URL vĩnh viễn (Không dùng Presigned URL)
            // Format: https://api.chatify.asia/chatapp-files/filename.jpg
            String publicUrl = String.format("%s/%s/%s", minioPublicUrl, bucketName, fileName);

            System.out.println("✅ Uploaded: " + publicUrl);

            // 5. Lưu thông tin vào Database
            MediaFile mediaFile = new MediaFile();
            mediaFile.setFileName(fileName);
            mediaFile.setContentType(file.getContentType());
            mediaFile.setSize(file.getSize());
            mediaFile.setUrl(publicUrl);
            mediaFile.setUploaderId(uploaderId);
            mediaFile.setCreatedAt(LocalDateTime.now());

            // Lưu bằng repository đã inject đúng
            return mediaFileRepository.save(mediaFile);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Failed to upload file to MinIO: " + e.getMessage());
        }
    }

    // Helper tạo chuỗi JSON Policy
    private String buildPublicReadPolicy(String bucketName) {
        return "{\n" +
                "    \"Version\": \"2012-10-17\",\n" +
                "    \"Statement\": [\n" +
                "        {\n" +
                "            \"Effect\": \"Allow\",\n" +
                "            \"Principal\": {\n" +
                "                \"AWS\": [\"*\"]\n" +
                "            },\n" +
                "            \"Action\": [\"s3:GetObject\"],\n" +
                "            \"Resource\": [\"arn:aws:s3:::" + bucketName + "/*\"]\n" +
                "        }\n" +
                "    ]\n" +
                "}";
    }
}