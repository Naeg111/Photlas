package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidUsername;
import jakarta.validation.constraints.*;

/**
 * ユーザー登録リクエストDTO
 * Issue#21: パスワードバリデーション統一
 * Issue#98: username バリデーション強化 - @ValidUsername で統一（@NotNull/@Size を削除）
 */
public class RegisterRequest {
    @ValidUsername
    private String username;

    @NotBlank(message = "メールアドレスは必須です")
    @Email(message = "正しいメールアドレスの形式で入力してください")
    private String email;

    @NotNull(message = "パスワードは必須です")
    @Size(min = 8, max = 20, message = "パスワードは8文字以上20文字以内で入力してください")
    // Issue#21: パスワードバリデーション統一 - 記号禁止、英数字のみ
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]+$",
        message = "パスワードには数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません"
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