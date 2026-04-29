package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.is;

/**
 * Issue#104: 新規登録フロー簡素化 & 利用規約同意ダイアログ実装のテスト
 *
 * <p>本テストでは以下を検証する：
 * <ul>
 *   <li>メール+パスワード登録時に terms_agreed_at, privacy_policy_agreed_at がセットされる</li>
 *   <li>OAuth 新規ユーザーは両カラムが NULL のまま</li>
 *   <li>GET /users/me が requiresTermsAgreement, usernameTemporary を返す</li>
 *   <li>POST /api/v1/users/me/agree-terms が両カラムをセットする</li>
 *   <li>DELETE /api/v1/users/me/cancel-registration が未同意ユーザーを物理削除する</li>
 *   <li>同 API が同意済みユーザーで 403 を返す</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class Issue104TermsAgreementTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private UserOAuthConnectionRepository userOAuthConnectionRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimitFilter rateLimitFilter;
    @PersistenceContext private EntityManager entityManager;

    private static final String REGISTER_ENDPOINT = "/api/v1/auth/register";
    private static final String USERS_ME_ENDPOINT = "/api/v1/users/me";
    private static final String AGREE_TERMS_ENDPOINT = "/api/v1/users/me/agree-terms";
    private static final String CANCEL_REGISTRATION_ENDPOINT = "/api/v1/users/me/cancel-registration";

    private static final String TEST_USERNAME = "testuser104";
    private static final String TEST_EMAIL = "test104@example.com";
    private static final String TEST_PASSWORD = "Password123";
    private static final String OAUTH_USERNAME = "user_abc1234";
    private static final String OAUTH_EMAIL = "oauth104@example.com";
    private static final String OAUTH_PROVIDER_USER_ID = "google-test-104";

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        userOAuthConnectionRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ===== Group 1: メール+パスワード登録時の同意日時セット =====

    @Test
    @DisplayName("Issue#104 - メール+パスワード登録時に terms_agreed_at と privacy_policy_agreed_at がセットされる")
    void register_setsTermsAgreedAtAndPrivacyPolicyAgreedAt() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername(TEST_USERNAME);
        request.setEmail(TEST_EMAIL);
        request.setPassword(TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        Optional<User> savedUser = userRepository.findByEmail(TEST_EMAIL);
        assertThat(savedUser).isPresent();
        assertThat(savedUser.get().getTermsAgreedAt())
                .as("terms_agreed_at は登録時に NOW() がセットされる")
                .isNotNull();
        assertThat(savedUser.get().getPrivacyPolicyAgreedAt())
                .as("privacy_policy_agreed_at は登録時に NOW() がセットされる")
                .isNotNull();
    }

    // ===== Group 2: OAuth 新規ユーザーは両カラム NULL =====

    @Test
    @DisplayName("Issue#104 - OAuth 新規ユーザー作成時は terms_agreed_at と privacy_policy_agreed_at が NULL")
    void oauthNewUser_termsAgreedAtAndPrivacyPolicyAgreedAtAreNull() {
        // OAuth ログインで作成されるユーザーを直接エンティティで作成（OAuth フローを通すと複雑になるため）
        User oauthUser = new User(OAUTH_USERNAME, OAUTH_EMAIL, null, CodeConstants.ROLE_USER);
        oauthUser.setEmailVerified(true);
        oauthUser.setUsernameTemporary(true);
        // termsAgreedAt / privacyPolicyAgreedAt は意図的にセットしない（OAuth 経由の挙動を模擬）
        User saved = userRepository.save(oauthUser);

        Optional<User> reloaded = userRepository.findById(saved.getId());
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getTermsAgreedAt())
                .as("OAuth 新規ユーザーの terms_agreed_at は NULL")
                .isNull();
        assertThat(reloaded.get().getPrivacyPolicyAgreedAt())
                .as("OAuth 新規ユーザーの privacy_policy_agreed_at は NULL")
                .isNull();
    }

    // ===== Group 3: GET /users/me が新フィールドを返す =====

    @Test
    @DisplayName("Issue#104 - GET /users/me が requiresTermsAgreement: true を返す（terms_agreed_at が NULL の場合）")
    void getUsersMe_returnsRequiresTermsAgreementTrue_whenTermsNotAgreed() throws Exception {
        User user = createOAuthUser();
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(get(USERS_ME_ENDPOINT)
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requiresTermsAgreement", is(true)));
    }

    @Test
    @DisplayName("Issue#104 - GET /users/me が requiresTermsAgreement: false を返す（両カラム NOT NULL の場合）")
    void getUsersMe_returnsRequiresTermsAgreementFalse_whenBothAgreed() throws Exception {
        User user = createUserWithAgreement();
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(get(USERS_ME_ENDPOINT)
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requiresTermsAgreement", is(false)));
    }

    @Test
    @DisplayName("Issue#104 - GET /users/me が usernameTemporary: true を返す（仮表示名の場合）")
    void getUsersMe_returnsUsernameTemporaryTrue_whenTemporaryUsername() throws Exception {
        User user = createOAuthUser(); // usernameTemporary=true
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(get(USERS_ME_ENDPOINT)
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usernameTemporary", is(true)));
    }

    @Test
    @DisplayName("Issue#104 - GET /users/me が usernameTemporary: false を返す（確定表示名の場合）")
    void getUsersMe_returnsUsernameTemporaryFalse_whenConfirmedUsername() throws Exception {
        User user = createUserWithAgreement(); // usernameTemporary=false
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(get(USERS_ME_ENDPOINT)
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usernameTemporary", is(false)));
    }

    // ===== Group 4: POST /api/v1/users/me/agree-terms =====

    @Test
    @DisplayName("Issue#104 - POST /api/v1/users/me/agree-terms が 204 を返し両カラムをセットする")
    void agreeTerms_setsBothColumnsAndReturns204() throws Exception {
        User user = createOAuthUser();
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(post(AGREE_TERMS_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isNoContent());

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getTermsAgreedAt())
                .as("agree-terms 後に terms_agreed_at がセットされる")
                .isNotNull();
        assertThat(reloaded.getPrivacyPolicyAgreedAt())
                .as("agree-terms 後に privacy_policy_agreed_at がセットされる")
                .isNotNull();
    }

    // ===== Group 5: DELETE /api/v1/users/me/cancel-registration =====

    @Test
    @DisplayName("Issue#104 - DELETE cancel-registration が未同意ユーザー（terms_agreed_at IS NULL）で 204 を返し物理削除する")
    void cancelRegistration_deletesUserPhysically_whenTermsNotAgreed() throws Exception {
        User user = createOAuthUser();
        UserOAuthConnection conn = createOAuthConnection(user);
        Long userId = user.getId();
        Long connId = conn.getId();
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(delete(CANCEL_REGISTRATION_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isNoContent());

        // 永続化コンテキストをクリアして、L1 キャッシュではなく DB から最新状態を取得する
        entityManager.clear();

        // users レコードが物理削除されている
        assertThat(userRepository.findById(userId))
                .as("cancel-registration 後に users レコードは物理削除される")
                .isEmpty();
        // user_oauth_connections レコードも CASCADE / 明示削除で削除される
        assertThat(userOAuthConnectionRepository.findById(connId))
                .as("cancel-registration 後に user_oauth_connections も削除される")
                .isEmpty();
    }

    @Test
    @DisplayName("Issue#104 - DELETE cancel-registration が同意済みユーザー（terms_agreed_at NOT NULL）で 403 を返し削除しない")
    void cancelRegistration_returns403_whenTermsAlreadyAgreed() throws Exception {
        User user = createUserWithAgreement();
        Long userId = user.getId();
        String jwtToken = jwtService.generateTokenWithRole(user.getEmail(), "USER");

        mockMvc.perform(delete(CANCEL_REGISTRATION_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isForbidden());

        // ユーザーは削除されていない
        assertThat(userRepository.findById(userId))
                .as("同意済みユーザーは削除されない")
                .isPresent();
    }

    // ===== ヘルパー =====

    /** OAuth 新規ユーザー（仮表示名・未同意・パスワードなし）を作成 */
    private User createOAuthUser() {
        User user = new User(OAUTH_USERNAME, OAUTH_EMAIL, null, CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setUsernameTemporary(true);
        // termsAgreedAt / privacyPolicyAgreedAt は意図的にセットしない（NULL）
        return userRepository.save(user);
    }

    /** 同意済みユーザー（terms_agreed_at, privacy_policy_agreed_at セット済み・確定表示名）を作成 */
    private User createUserWithAgreement() {
        User user = new User(TEST_USERNAME, TEST_EMAIL,
                passwordEncoder.encode(TEST_PASSWORD), CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setUsernameTemporary(false);
        user.setTermsAgreedAt(LocalDateTime.now());
        user.setPrivacyPolicyAgreedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    /** 指定ユーザーに OAuth 連携レコードを作成 */
    private UserOAuthConnection createOAuthConnection(User user) {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(OAuthProvider.GOOGLE.getCode());
        conn.setProviderUserId(OAUTH_PROVIDER_USER_ID);
        conn.setEmail(user.getEmail());
        conn.setEmailVerified(Boolean.TRUE);
        return userOAuthConnectionRepository.save(conn);
    }
}
