package com.chatapp.media_service.controller;


import com.chatapp.media_service.entity.MediaFile;
import com.chatapp.media_service.repository.MediaFileRepository;
import com.chatapp.media_service.service.MinioStorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/media")
public class MediaController {

    private final MinioStorageService minioStorageService;
    private final MediaFileRepository mediaFileRepository;

    public MediaController(MinioStorageService minioStorageService, MediaFileRepository mediaFileRepository) {
        this.minioStorageService = minioStorageService;
        this.mediaFileRepository = mediaFileRepository;
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "uploaderId", required = false) String uploaderId // ID người gửi
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }

        try {
            // 1. Upload lên MinIO
            String storedFileName = minioStorageService.uploadFileToMinio(file);
            String publicUrl = minioStorageService.getPublicUrl(storedFileName);

            // 2. Lưu metadata vào DB
            MediaFile mediaFile = MediaFile.builder()
                    .fileName(file.getOriginalFilename())
                    .contentType(file.getContentType())
                    .size(file.getSize())
                    .url(publicUrl)
                    .uploaderId(uploaderId != null ? uploaderId : "anonymous")
                    .build();

            mediaFileRepository.save(mediaFile);

            // 3. Trả về kết quả cho Client
            Map<String, Object> response = new HashMap<>();
            response.put("url", publicUrl);
            response.put("type", file.getContentType());
            response.put("fileName", file.getOriginalFilename());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Upload failed: " + e.getMessage());
        }
    }
}
