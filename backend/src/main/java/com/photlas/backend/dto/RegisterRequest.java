package com.photlas.backend.dto;

import jakarta.validation.constraints.*;

/**
 * ユーザー登録リクエストDTO
 * Issue#21: パスワードバリデーション統一
 */
public class RegisterRequest {
    @NotNull(message = "Username is required")
    @Size(min = 2, max = 12, message = "Username must be between 2 and 12 characters")
    private String username;

    @NotNull(message = "Email is required")
    @Email(message = "Email should be valid")
    private String email;

    @NotNull(message = "Password is required")
    @Size(min = 8, max = 20, message = "Password must be between 8 and 20 characters")
    // Issue#21: パスワードバリデーション統一 - 記号禁止、英数字のみ
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]+$",
        message = "Password must contain at least one digit, one lowercase letter, one uppercase letter, and no special characters"
    )
    private String password;

    public RegisterRequest() {}

    public RegisterRequest(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}