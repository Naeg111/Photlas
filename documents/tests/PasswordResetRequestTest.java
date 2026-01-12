// このテストクラスが属するパッケージを宣言
package com.photlas.backend.controller;

// Jackson ObjectMapperをインポート（JavaオブジェクトをJSON文字列に変換するため）
import com.fasterxml.jackson.databind.ObjectMapper;
// パスワードリセットリクエストのDTOをインポート
import com.photlas.backend.dto.PasswordResetRequest;
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
// ActiveProfilesアノテーションをインポート（テスト用プロファイルを有効化）
import org.springframework.test.context.ActiveProfiles;
// MockMvcをインポート（HTTPリクエストをシミュレートするテストツール）
import org.springframework.test.web.servlet.MockMvc;
// Transactionalアノテーションをインポート（各テスト後にDBをロールバック）
import org.springframework.transaction.annotation.Transactional;

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
 * Issue#6: パスワードリセット機能 - パスワードリセットリクエストAPI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * API要件:
 * - POST /api/v1/auth/password-reset-request
 * - リクエストボディ: { "email": "user@example.com" }
 * - メールアドレスの存在確認
 * - パスワードリセットトークンの生成（有効期限30分）
 * - メール送信（Amazon SES経由）
 * - セキュリティ上、メールアドレスが存在しない場合でも同じレスポンスを返す
 */
// Spring Bootテストとして実行（MOCKモードでWebサーバーを起動せずにテスト）
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
// MockMvcの自動設定を有効化（コントローラーのテストに必要）
@AutoConfigureMockMvc
// testプロファイルを有効化（テスト用の設定を使用）
@ActiveProfiles("test")
// 各テストメソッドをトランザクション内で実行し、終了後にロールバック（DBの状態を保つ）
@Transactional
public class PasswordResetRequestTest {

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

    // 各テストメソッドの実行前に呼ばれる処理（テストの独立性を保つため）
    @BeforeEach
    void setUp() {
        // パスワードリセットトークンを全て削除（前のテストの影響を受けないようにする）
        passwordResetTokenRepository.deleteAll();
        // ユーザーを全て削除
        userRepository.deleteAll();
    }

    // 有効なメールアドレスでパスワードリセットリクエストを送信した場合の正常系テスト
    @Test
    @DisplayName("正常なパスワードリセットリクエスト - 200 OK と成功メッセージを返す")
    void testPasswordResetRequest_ValidEmail_ReturnsOk() throws Exception {
        // テスト用のユーザーエンティティを作成
        User user = new User();
        // ユーザー名を設定
        user.setUsername("testuser");
        // メールアドレスを設定
        user.setEmail("test@example.com");
        // パスワードハッシュを設定（実際のハッシュではなくテスト用の文字列）
        user.setPasswordHash("hashed-password");
        // ロール（権限）を設定
        user.setRole("USER");
        // ユーザーをデータベースに保存
        userRepository.save(user);

        // パスワードリセットリクエストのDTOを作成
        PasswordResetRequest request = new PasswordResetRequest();
        // リクエストにメールアドレスを設定
        request.setEmail("test@example.com");

        // MockMvcを使用してPOSTリクエストを実行し、結果を検証
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                // Content-TypeをJSON形式に設定
                .contentType(MediaType.APPLICATION_JSON)
                // リクエストボディにDTOをJSON文字列に変換して設定
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが200 OKであることを検証
                .andExpect(status().isOk())
                // レスポンスJSONのmessageフィールドが期待値と一致することを検証
                .andExpect(jsonPath("$.message", is("パスワードリセット用のメールを送信しました。メールをご確認ください。")));
    }

    // パスワードリセットトークンがデータベースに正しく保存されることを検証
    @Test
    @DisplayName("パスワードリセットトークンがDBに保存される")
    void testPasswordResetRequest_ValidEmail_SavesTokenToDatabase() throws Exception {
        // テスト用のユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        // ユーザーをデータベースに保存
        userRepository.save(user);

        // パスワードリセットリクエストを作成
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが200 OKであることを検証
                .andExpect(status().isOk());

        // データベースからユーザーIDに紐づくトークンを取得（存在しない場合はnull）
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        // トークンがnullでないこと（保存されていること）を検証
        assertNotNull(savedToken, "パスワードリセットトークンがDBに保存されている");
        // トークンのユーザーIDが正しいことを検証
        assertEquals(user.getId(), savedToken.getUserId(), "トークンが正しいユーザーに関連付けられている");
        // トークン文字列が生成されていることを検証
        assertNotNull(savedToken.getToken(), "トークンが生成されている");
        // 有効期限が設定されていることを検証
        assertNotNull(savedToken.getExpiryDate(), "有効期限が設定されている");
    }

    // トークンの有効期限が正しく30分後に設定されることを検証
    @Test
    @DisplayName("トークンの有効期限が30分に設定される")
    void testPasswordResetRequest_ValidEmail_SetsExpiryTo30Minutes() throws Exception {
        // テスト用のユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        // パスワードリセットリクエストを作成
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        // リクエスト実行前の時刻を記録（ミリ秒単位）
        long beforeRequest = System.currentTimeMillis();

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // リクエスト実行後の時刻を記録
        long afterRequest = System.currentTimeMillis();

        // データベースから保存されたトークンを取得
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        // トークンが存在することを検証
        assertNotNull(savedToken);

        // トークンの有効期限をミリ秒で取得
        long tokenExpiryTime = savedToken.getExpiryDate().getTime();
        // 期待される最小の有効期限（リクエスト前の時刻 + 30分）を計算
        long expectedMinExpiry = beforeRequest + (30 * 60 * 1000); // 30分後
        // 期待される最大の有効期限（リクエスト後の時刻 + 30分）を計算
        long expectedMaxExpiry = afterRequest + (30 * 60 * 1000);

        // トークンの有効期限が期待範囲内であることを検証
        assertTrue(tokenExpiryTime >= expectedMinExpiry && tokenExpiryTime <= expectedMaxExpiry,
                "トークンの有効期限が30分に設定されている");
    }

    // 存在しないメールアドレスでも同じレスポンスを返すことを検証（セキュリティ対策）
    @Test
    @DisplayName("存在しないメールアドレスでも同じレスポンスを返す（セキュリティ）")
    void testPasswordResetRequest_NonExistentEmail_ReturnsSameResponse() throws Exception {
        // パスワードリセットリクエストを作成（存在しないメールアドレスを設定）
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("nonexistent@example.com");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが200 OKであることを検証（存在する場合と同じレスポンス）
                .andExpect(status().isOk())
                // メッセージも同じであることを検証（メールアドレスの存在を推測されないため）
                .andExpect(jsonPath("$.message", is("パスワードリセット用のメールを送信しました。メールをご確認ください。")));
    }

    // 存在しないメールアドレスの場合、トークンが保存されないことを検証
    @Test
    @DisplayName("存在しないメールアドレスの場合、トークンは保存されない")
    void testPasswordResetRequest_NonExistentEmail_DoesNotSaveToken() throws Exception {
        // パスワードリセットリクエストを作成（存在しないメールアドレスを設定）
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("nonexistent@example.com");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベース内のトークン数が0であることを検証（トークンが保存されていない）
        assertEquals(0, passwordResetTokenRepository.count(), "存在しないメールアドレスの場合、トークンは保存されない");
    }

    // メールアドレスが空の場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - email必須")
    void testPasswordResetRequest_MissingEmail_ReturnsBadRequest() throws Exception {
        // パスワードリセットリクエストを作成（メールアドレスを設定しない）
        PasswordResetRequest request = new PasswordResetRequest();

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"email"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    // 不正な形式のメールアドレスの場合にバリデーションエラーが返されることを検証
    @Test
    @DisplayName("バリデーションエラー - email形式不正")
    void testPasswordResetRequest_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        // パスワードリセットリクエストを作成（不正な形式のメールアドレスを設定）
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("invalid-email");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                // HTTPステータスコードが400 Bad Requestであることを検証
                .andExpect(status().isBadRequest())
                // エラー配列のサイズが1であることを検証
                .andExpect(jsonPath("$.errors", hasSize(1)))
                // エラーのfieldフィールドが"email"であることを検証
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    // 既存のトークンがある場合に新しいトークンで上書きされることを検証
    @Test
    @DisplayName("既存のトークンがある場合、新しいトークンで上書きされる")
    void testPasswordResetRequest_ExistingToken_ReplacesWithNewToken() throws Exception {
        // テスト用のユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        // ユーザーをデータベースに保存し、生成されたIDを取得
        user = userRepository.save(user);

        // 既存のパスワードリセットトークンを作成
        PasswordResetToken oldToken = new PasswordResetToken();
        // トークンにユーザーIDを設定
        oldToken.setUserId(user.getId());
        // 古いトークン文字列を設定
        oldToken.setToken("old-token");
        // 有効期限を現在時刻 + 30分に設定
        oldToken.setExpiryDate(new java.util.Date(System.currentTimeMillis() + 1800000));
        // 古いトークンをデータベースに保存
        passwordResetTokenRepository.save(oldToken);

        // パスワードリセットリクエストを作成
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベースから新しいトークンを取得
        PasswordResetToken newToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        // トークンが存在することを検証
        assertNotNull(newToken);
        // 新しいトークンが古いトークンと異なることを検証（上書きされている）
        assertNotEquals("old-token", newToken.getToken(), "新しいトークンが生成されている");
    }

    // 生成されるトークンが推測困難なランダム文字列であることを検証
    @Test
    @DisplayName("トークンは推測困難なランダム文字列である")
    void testPasswordResetRequest_GeneratesSecureRandomToken() throws Exception {
        // テスト用のユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        // パスワードリセットリクエストを作成
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        // パスワードリセットリクエストAPIを実行
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // データベースから保存されたトークンを取得
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        // トークンが存在することを検証
        assertNotNull(savedToken);
        // トークンの長さが32文字以上であることを検証（十分に長いことを確認）
        assertTrue(savedToken.getToken().length() >= 32, "トークンは十分に長い（32文字以上）");
        // トークンが英数字とハイフン、アンダースコアのみで構成されていることを検証
        assertTrue(savedToken.getToken().matches("^[a-zA-Z0-9\\-_]+$"), "トークンは英数字で構成されている");
    }
}
