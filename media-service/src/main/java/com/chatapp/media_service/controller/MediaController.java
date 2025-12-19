package com.chatapp.media_service.controller;

import com.chatapp.media_service.entity.MediaFile;
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

    public MediaController(MinioStorageService minioStorageService) {
        this.minioStorageService = minioStorageService;
    }

    @PostMapping(value = "/upload", consumes = "multipart/form-data")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            // [KIẾN TRÚC CHUẨN] Nhận ID từ Header do Gateway gửi xuống
            // Gateway sẽ giải mã token và nhét ID vào header này
            @RequestHeader(value = "X-User-Id", required = false) String userId
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("File is empty");
        }

        try {
            // Nếu Gateway quên gửi hoặc user chưa login, ta coi là anonymous
            if (userId == null || userId.isEmpty()) {
                userId = "anonymous";
            }

            // Gọi Service xử lý
            MediaFile savedFile = minioStorageService.uploadFile(file, userId);

            // Trả về kết quả
            Map<String, Object> response = new HashMap<>();
            response.put("url", savedFile.getUrl());
            response.put("fileName", savedFile.getFileName());
            response.put("type", savedFile.getContentType());
            response.put("size", savedFile.getSize());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Upload failed: " + e.getMessage());
        }
    }
}