package com.chatapp.auth_service.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Username không được để trống")
    @Size(min = 3, max = 20, message = "Username phải từ 3 đến 20 ký tự")
    @Pattern(regexp = "^[a-zA-Z0-9]*$", message = "Username chỉ được chứa chữ và số, không có ký tự đặc biệt")
    private String username;

    @NotBlank(message = "Password không được để trống")
    @Size(min = 6, message = "Password phải có ít nhất 6 ký tự")
    // Bạn có thể thêm @Pattern nếu muốn bắt buộc có chữ hoa, số, v.v.
    private String password;

    @Size(max = 50, message = "Tên hiển thị không được quá 50 ký tự")
    private String displayName;

    @NotBlank(message = "Email không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;
}