package com.chatapp.auth_service.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    
    @Size(max = 50, message = "Tên hiển thị không được quá 50 ký tự")
    private String fullName;

    @Size(max = 15, message = "Số điện thoại không được quá 15 ký tự")
    private String phone;

    @Size(max = 500, message = "Bio không được quá 500 ký tự")
    private String bio;

    private String avatarUrl;
}

