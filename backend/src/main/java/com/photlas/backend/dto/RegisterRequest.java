package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidUsername;
import jakarta.validation.constraints.*;

/**
 * ユーザー登録リクエストDTO
 * Issue#21: パスワードバリデーション統一
 * Issue#98: username バリデーション強化 - @ValidUsername で統一（@NotNull/@Size を削除）
 * Issue#109: 利用規約・プライバシーポリシー・年齢確認の同意フィールドを追加
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

    // Issue#109: 利用規約への同意（true 必須）
    @AssertTrue(message = "利用規約への同意が必要です")
    private boolean agreedToTerms;

    // Issue#109: プライバシーポリシーへの同意（true 必須）
    @AssertTrue(message = "プライバシーポリシーへの同意が必要です")
    private boolean agreedToPrivacy;

    // Issue#109: 年齢確認（13 歳以上、true 必須）
    @AssertTrue(message = "13 歳以上であることの確認が必要です")
    private boolean ageConfirmed;

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

    public boolean isAgreedToTerms() {
        return agreedToTerms;
    }

    public void setAgreedToTerms(boolean agreedToTerms) {
        this.agreedToTerms = agreedToTerms;
    }

    public boolean isAgreedToPrivacy() {
        return agreedToPrivacy;
    }

    public void setAgreedToPrivacy(boolean agreedToPrivacy) {
        this.agreedToPrivacy = agreedToPrivacy;
    }

    public boolean isAgeConfirmed() {
        return ageConfirmed;
    }

    public void setAgeConfirmed(boolean ageConfirmed) {
        this.ageConfirmed = ageConfirmed;
    }
}