// このテストクラスが属するパッケージを宣言
package com.photlas.backend.controller;

// Jackson ObjectMapperをインポート（JavaオブジェクトをJSON文字列に変換するため）
import com.fasterxml.jackson.databind.ObjectMapper;
// パスワード再設定リクエストのDTOをインポート
import com.photlas.backend.dto.ResetPasswordRequest;
// Userエンティティをインポート（データベースのusersテーブルに対応）
import com.photlas.backend.entity.User;
// PasswordResetTokenエンティティをインポート（パスワードリセットトークンを格納）
import com.photlas.backend.entity.PasswordResetToken;
// UserRepositoryをインポート（ユーザーデータの永続化を担当）
import com.photlas.backend.repository.UserRepository;
// PasswordResetTokenRepositoryをインポート（パスワードリセットトークンの永続化を担当）
import com.photlas.backend.repository.PasswordResetTokenRepository;
// JUnit5のBeforeEachアノテーションをインポート（各テストの前に実行される処理を定義）
import org.junit.jupiter.api.BeforeEach;
// JUnit5のTestアノテーションをインポート（テストメソッドであることを示す）
import org.junit.jupiter.api.Test;
// DisplayNameアノテーションをインポート（テストの日本語名を定義）
import org.junit.jupiter.api.DisplayName;
// Autowiredアノテーションをインポート（依存性の自動注入に使用）
import org.springframework.beans.factory.annotation.Autowired;
// MockMvcの自動設定アノテーションをインポート（MockMvcを使用したテストを有効化）
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
// Spring Boot統合テストアノテーションをインポート（Springコンテキスト全体をロード）
import org.springframework.boot.test.context.SpringBootTest;
// MediaTypeをインポート（HTTPリクエストのContent-Typeを指定）
import org.springframework.http.MediaType;
// PasswordEncoderをインポート（パスワードのハッシュ化と検証に使用）
import org.springframework.security.crypto.password.PasswordEncoder;
// ActiveProfilesアノテーションをインポート（テスト用プロファイルを有効化）
import org.springframework.test.context.ActiveProfiles;
// MockMvcをインポート（HTTPリクエストをシミュレートするテストツール）
import org.springframework.test.web.servlet.MockMvc;
// Transactionalアノテーションをインポート（各テスト後にDBをロールバック）
import org.springframework.transaction.annotation.Transactional;

// Dateクラスをインポート（日時の扱いに使用）
import java.util.Date;

// MockMvcRequestBuildersからpostメソッドをインポート（POSTリクエストを作成）
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
// MockMvcResultMatchersから結果検証用メソッドをインポート
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
// Hamcrest Matchersからis, hasSizeメソッドをインポート（値の検証に使用）
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.hasSize;
// JUnitのアサーションメソッドをインポート（値の検証に使用）
import static org.junit.jupiter.api.Assertions.*;

/**
 * Issue#6: パスワードリセット機能 - パスワード再設定API テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * API要件:
 * - POST /api/v1/auth/reset-password
 * - リクエストボディ: { "token": "...", "newPassword": "...", "confirmPassword": "..." }
 * - トークンの有効性検証（存在確認、期限確認）
 * - パスワードの一致確認
 * - パスワードルールの検証（新規登録時と同じ）
 * - パスワードのハッシュ化と更新
 * - トークンの無効化
 * - 200 OK と成功メッセージを返す
 */
// Spring Bootテストとして実行（MOCKモードでWebサーバーを起動せずにテスト）
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
// MockMvcの自動設定を有効化（コントローラーのテストに必要）
@AutoConfigureMockMvc
// testプロファイルを有効化（テスト用の設定を使用）
@ActiveProfiles("test")
// 各テストメソッドをトランザクション内で実行し、終了後にロールバック（DBの状態を保つ）
@Transactional
public class ResetPasswordTest {

    // MockMvcを自動注入（HTTPリクエストのテストに使用）
    @Autowired
    private MockMvc mockMvc;

    // ObjectMapperを自動注入（JavaオブジェクトとJSONの相互変換に使用）
    @Autowired
    private ObjectMapper objectMapper;

    // UserRepositoryを自動注入（テストデータの作成と検証に使用）
    @Autowired
    private UserRepository userRepository;

    // PasswordResetTokenRepositoryを自動注入（トークンの保存と検証に使用）
    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    // PasswordEncoderを自動注入（パスワードのハッシュ化と検証に使用）
    @Autowired
    private PasswordEncoder passwordEncoder;

    // テスト用のユーザーオブジェクト（各テストで使用）
    private User testUser;
    // 有効なパスワードリセットトークン（各テストで使用）
    private PasswordResetToken validToken;

    // 各テストメソッドの実行前に呼ばれる処理（テストの独立性を保つため）
    @BeforeEach
    void setUp() {
        // パスワードリセットトークンを全て削除（前のテストの影響を受けないようにする）
        passwordResetTokenRepository.deleteAll();
        // ユーザーを全て削除
        userRepository.deleteAll();

        // テスト用のユーザーエンティティを作成
        testUser = new User();
        // ユーザー名を設定
        testUser.setUsername("testuser");
        // メールアドレスを設定
        testUser.setEmail("test@example.com");
        // パスワードハッシュを設定（古いパスワードとして使用）
        testUser.setPasswordHash("old-hashed-password");
        // ロール（権限）を設定
        testUser.setRole("USER");
        // ユーザーをデータベースに保存し、生成されたIDを取得
        testUser = userRepository.save(testUser);

        // 有効なパスワードリセットトークンを作成
        validToken = new PasswordResetToken();
        // トークンにユーザーIDを設定
        validToken.setUserId(testUser.getId());
        // トークン文字列を設定
        validToken.setToken("valid-reset-token");
        // 有効期限を現在時刻 + 30分（1800000ミリ秒）に設定
        validToken.setExpiryDate(new Date(System.currentTimeMillis() + 1800000)); // 30分後
        // トークンをデータベースに保存
        validToken = passwordResetTokenRepository.save(validToken);
    }

    // 有効なリクエストでパスワード再設定が成功することを検証
    @Test
    @DisplayName("正常なパスワード再設定 - 200 OK と成功メッセージを返す")
    void testResetPassword_ValidRequest_ReturnsOk() throws Exception {
        // パスワード再設定リクエストのDTOを作成
        ResetPasswordRequest request = new ResetPasswordRequest();
        // トークンを設定
        request.setToken("valid-reset-token");
        // 新しいパスワードを設定
        request.setNewPassword("NewPassword123");
        // 確認用パスワードを設定
        request.setConfirmPassword("NewPassword123");

        // MockMvcを使用してPOSTリクエストを実行し、結果を検証
        mockMvc.perform(post("/api/v1/auth/reset-password")
                // Content-TypeをJSON形式に設定
                .contentType(MediaType.APPLICATION_JSON)
                // リクエストボディにDTOをJSON文字列に変換して設定
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが200 OKであることを検証
                .andExpect(status().isOk())
                // レスポンスJSONのmessageフィールドが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("パスワードが正常に再設定されました")));
    }

    // パスワードが正しくハッシュ化されてデータベースに保存されることを検証
    @Test
    @DisplayName("パスワードがハッシュ化されてDBに保存される")
    void testResetPassword_ValidRequest_UpdatesPasswordHash() throws Exception {
        // 古いパスワードハッシュを保存（後で比較するため）
        String oldPasswordHash = testUser.getPasswordHash();

        // パスワード再設定リクエストを作成
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベースから更新されたユーザーを取得
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        // ユーザーが存在することを検証
        assertNotNull(updatedUser);
        // 新しいパスワードハッシュが古いものと異なることを検証（更新されている）
        assertNotEquals(oldPasswordHash, updatedUser.getPasswordHash(), "パスワードハッシュが更新されている");
        // 新しいパスワードが正しくハッシュ化されて保存されていることを検証（PasswordEncoderのmatchesメソッドを使用）
        assertTrue(passwordEncoder.matches("NewPassword123", updatedUser.getPasswordHash()),
                "新しいパスワードが正しくハッシュ化されて保存されている");
    }

    // パスワード再設定後にトークンが無効化されることを検証
    @Test
    @DisplayName("パスワード再設定後、トークンが無効化される")
    void testResetPassword_ValidRequest_InvalidatesToken() throws Exception {
        // パスワード再設定リクエストを作成
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベースから使用済みトークンを検索（存在しない場合はnull）
        PasswordResetToken token = passwordResetTokenRepository.findByToken("valid-reset-token").orElse(null);
        // トークンがnullであることを検証（削除または無効化されている）
        assertNull(token, "トークンが削除または無効化されている");
    }

    // 存在しないトークンで再設定しようとするとエラーが返されることを検証
    @Test
    @DisplayName("エラー - トークンが存在しない")
    void testResetPassword_NonExistentToken_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（存在しないトークンを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("non-existent-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラーメッセージが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    // 期限切れのトークンで再設定しようとするとエラーが返されることを検証
    @Test
    @DisplayName("エラー - トークンが期限切れ")
    void testResetPassword_ExpiredToken_ReturnsBadRequest() throws Exception {
        // 期限切れのトークンを作成
        PasswordResetToken expiredToken = new PasswordResetToken();
        // トークンにユーザーIDを設定
        expiredToken.setUserId(testUser.getId());
        // トークン文字列を設定
        expiredToken.setToken("expired-token");
        // 有効期限を現在時刻 - 1秒に設定（既に期限切れ）
        expiredToken.setExpiryDate(new Date(System.currentTimeMillis() - 1000)); // 1秒前（期限切れ）
        // 期限切れトークンをデータベースに保存
        passwordResetTokenRepository.save(expiredToken);

        // パスワード再設定リクエストを作成（期限切れトークンを使用）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("expired-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラーメッセージが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    // トークンが未入力の場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - token必須")
    void testResetPassword_MissingToken_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（トークンを設定しない）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"token"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("token")));
    }

    // 新しいパスワードが未入力の場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - newPassword必須")
    void testResetPassword_MissingNewPassword_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（新しいパスワードを設定しない）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"newPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    // 確認用パスワードが未入力の場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - confirmPassword必須")
    void testResetPassword_MissingConfirmPassword_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（確認用パスワードを設定しない）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"confirmPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("confirmPassword")));
    }

    // 新しいパスワードと確認用パスワードが一致しない場合にエラーが返されることを検証
    @Test
    @DisplayName("エラー - パスワードが一致しない")
    void testResetPassword_PasswordMismatch_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（異なるパスワードを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("DifferentPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラーメッセージが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("パスワードが一致しません")));
    }

    // パスワードが8文字未満の場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - パスワード文字数制限（8文字未満）")
    void testResetPassword_PasswordTooShort_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（5文字のパスワードを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("Pass1"); // 5文字
        request.setConfirmPassword("Pass1");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"newPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    // パスワードに大文字が含まれていない場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（大文字なし）")
    void testResetPassword_PasswordWithoutUppercase_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（小文字と数字のみのパスワードを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("password123"); // 大文字なし
        request.setConfirmPassword("password123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"newPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    // パスワードに小文字が含まれていない場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（小文字なし）")
    void testResetPassword_PasswordWithoutLowercase_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（大文字と数字のみのパスワードを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("PASSWORD123"); // 小文字なし
        request.setConfirmPassword("PASSWORD123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"newPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    // パスワードに数字が含まれていない場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（数字なし）")
    void testResetPassword_PasswordWithoutNumber_ReturnsBadRequest() throws Exception {
        // パスワード再設定リクエストを作成（大文字と小文字のみのパスワードを設定）
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("PasswordOnly"); // 数字なし
        request.setConfirmPassword("PasswordOnly");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"newPassword"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    // 同じトークンで2回パスワード再設定できないことを検証（トークンの再利用防止）
    @Test
    @DisplayName("同じトークンで2回パスワード再設定できない")
    void testResetPassword_TokenCannotBeReused() throws Exception {
        // 1回目のパスワード再設定リクエストを作成
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // 1回目のパスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが200 OKであることを検証
                .andExpect(status().isOk());

        // 2回目のパスワード再設定リクエストを作成（同じトークンを使用）
        ResetPasswordRequest secondRequest = new ResetPasswordRequest();
        secondRequest.setToken("valid-reset-token");
        secondRequest.setNewPassword("AnotherPassword456");
        secondRequest.setConfirmPassword("AnotherPassword456");

        // 2回目のパスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(secondRequest)))
                // HTTPステータスコードが400 Bad Requestであることを検証（トークンが既に使用済み）
                .andExpect(status().isBadRequest())
                // エラーメッセージが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    // パスワード再設定後、古いパスワードでは認証できないことを検証
    @Test
    @DisplayName("パスワード再設定後、古いパスワードではログインできない")
    void testResetPassword_OldPasswordNoLongerWorks() throws Exception {
        // 古いパスワードを定義
        String oldPassword = "OldPassword123";
        // 古いパスワードをハッシュ化してユーザーに設定
        testUser.setPasswordHash(passwordEncoder.encode(oldPassword));
        // ユーザーをデータベースに保存
        userRepository.save(testUser);

        // パスワード再設定リクエストを作成
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // パスワード再設定APIを実行
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベースから更新されたユーザーを取得
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        // ユーザーが存在することを検証
        assertNotNull(updatedUser);
        // 古いパスワードでは認証できないことを検証（PasswordEncoderのmatchesメソッドがfalseを返す）
        assertFalse(passwordEncoder.matches(oldPassword, updatedUser.getPasswordHash()),
                "古いパスワードでは認証できない");
        // 新しいパスワードで認証できることを検証（PasswordEncoderのmatchesメソッドがtrueを返す）
        assertTrue(passwordEncoder.matches("NewPassword123", updatedUser.getPasswordHash()),
                "新しいパスワードで認証できる");
    }
}
