package com.chatapp.media_service.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "media_files")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaFile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String fileName; // UUID-based unique filename stored in MinIO
    private String originalFileName; // Original filename from user upload
    private String contentType;

    // --- [SỬA LẠI DÒNG NÀY] ---
    // Chuyển sang kiểu TEXT để lưu chuỗi siêu dài (không giới hạn 255 ký tự nữa)
    @Column(columnDefinition = "TEXT")
    private String url;

    private Long size;
    private String uploaderId;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}