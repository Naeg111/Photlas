package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UploadUrlRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import com.photlas.backend.service.JwtService;
import com.photlas.backend.service.S3Service;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserSnsLinkRepository userSnsLinkRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private S3Service s3Service;

    private User testUser;
    private String jwtToken;

    // Test Data Constants
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "password";
    private static final String USER_ROLE = "USER";

    private static final String NEW_USERNAME = "newusername";
    private static final String NEW_EMAIL = "newemail@example.com";
    private static final String EXISTING_USERNAME = "existinguser";
    private static final String OTHER_USERNAME = "otheruser";
    private static final String OTHER_EMAIL = "other@example.com";

    private static final String INVALID_USERNAME_SHORT = "a";
    private static final String INVALID_EMAIL = "invalid-email";
    private static final String WRONG_PASSWORD = "wrongpassword";

    private static final String NEW_PASSWORD = "NewPass123";
    private static final String DIFFERENT_PASSWORD = "DifferentPass123";
    private static final String SHORT_PASSWORD = "short";
    private static final String PASSWORD_WITH_SPECIAL = "NewPass123!";
    private static final String PASSWORD_TOO_LONG = "NewPass12345678901234";

    private static final String SNS_LINK_X = "https://x.com/testuser";
    private static final String SNS_LINK_INSTAGRAM = "https://instagram.com/testuser";
    private static final String SNS_LINK_NEW_X = "https://x.com/newuser";
    private static final String SNS_LINK_FACEBOOK = "https://facebook.com/user";
    private static final String SNS_LINK_LINKEDIN = "https://linkedin.com/user";

    private static final String FILE_EXTENSION_JPG = "jpg";
    private static final String CONTENT_TYPE_JPEG = "image/jpeg";

    private static final String MOCK_S3_BASE_URL = "https://test-bucket.s3.us-east-1.amazonaws.com/";

    private static final int PAGE_NUMBER_0 = 0;
    private static final int PAGE_SIZE_20 = 20;

    private static final Long NON_EXISTENT_USER_ID = 99999L;

    // Endpoint Constants
    private static final String USER_ME_ENDPOINT = "/api/v1/users/me";
    private static final String USER_BY_ID_ENDPOINT_PREFIX = "/api/v1/users/";
    private static final String USER_PROFILE_ENDPOINT = "/api/v1/users/me/profile";
    private static final String USER_AVATAR_UPLOAD_URL_ENDPOINT = "/api/v1/users/me/avatar-upload-url";
    private static final String USER_EMAIL_ENDPOINT = "/api/v1/users/me/email";
    private static final String USER_PASSWORD_ENDPOINT = "/api/v1/users/me/password";
    private static final String USER_PHOTOS_SUFFIX = "/photos";

    // JSONPath Constants
    private static final String JSON_PATH_USER_ID = "$.userId";
    private static final String JSON_PATH_USERNAME = "$.username";
    private static final String JSON_PATH_EMAIL = "$.email";
    private static final String JSON_PATH_PROFILE_IMAGE_URL = "$.profileImageUrl";
    private static final String JSON_PATH_SNS_LINKS = "$.snsLinks";
    private static final String JSON_PATH_SNS_LINK_0_URL = "$.snsLinks[0].url";
    private static final String JSON_PATH_SNS_LINK_1_URL = "$.snsLinks[1].url";
    private static final String JSON_PATH_MESSAGE = "$.message";
    private static final String JSON_PATH_ERRORS_0_FIELD = "$.errors[0].field";
    private static final String JSON_PATH_UPLOAD_URL = "$.uploadUrl";
    private static final String JSON_PATH_OBJECT_KEY = "$.objectKey";
    private static final String JSON_PATH_CONTENT = "$.content";
    private static final String JSON_PATH_PAGE = "$.page";
    private static final String JSON_PATH_SIZE = "$.size";
    private static final String JSON_PATH_TOTAL_ELEMENTS = "$.totalElements";
    private static final String JSON_PATH_TOTAL_PAGES = "$.totalPages";

    // Parameter Constants
    private static final String PARAM_PAGE = "page";
    private static final String PARAM_SIZE = "size";

    // Header Constants
    private static final String HEADER_AUTHORIZATION = "Authorization";

    // JSON Field Constants
    private static final String FIELD_NEW_EMAIL = "new_email";
    private static final String FIELD_CURRENT_PASSWORD = "current_password";
    private static final String FIELD_NEW_PASSWORD = "new_password";
    private static final String FIELD_NEW_PASSWORD_CONFIRM = "new_password_confirm";
    private static final String FIELD_PASSWORD = "password";

    // Error Message Constants
    private static final String ERROR_WRONG_PASSWORD = "パスワードが正しくありません";
    private static final String ERROR_EMAIL_ALREADY_USED = "このメールアドレスはすでに使用されています";
    private static final String ERROR_CURRENT_PASSWORD_WRONG = "現在のパスワードが正しくありません";
    private static final String ERROR_PASSWORD_MISMATCH = "新しいパスワードが一致しません";

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        userSnsLinkRepository.deleteAll();

        // テストユーザーを作成
        testUser = createTestUser(TEST_USERNAME, TEST_EMAIL);

        // JWTトークンを生成
        jwtToken = jwtService.generateToken(testUser.getEmail());

        // S3Serviceのモック設定
        when(s3Service.generateCdnUrl(anyString())).thenAnswer(invocation -> {
            String s3Key = invocation.getArgument(0);
            if (s3Key == null) {
                return null;
            }
            return MOCK_S3_BASE_URL + s3Key;
        });

        when(s3Service.generatePresignedUploadUrl(anyString(), anyLong(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String folder = invocation.getArgument(0);
                    Long userId = invocation.getArgument(1);
                    String extension = invocation.getArgument(2);
                    String objectKey = String.format("%s/%d/test-uuid.%s", folder, userId, extension);
                    String uploadUrl = MOCK_S3_BASE_URL + objectKey + "?signature=test";
                    return new S3Service.UploadUrlResult(uploadUrl, objectKey);
                });
    }

    // Helper Methods
    private User createTestUser(String username, String email) {
        User user = new User(username, email, passwordEncoder.encode(TEST_PASSWORD), USER_ROLE);
        return userRepository.save(user);
    }

    private UpdateProfileRequest createUpdateProfileRequest(String username, List<String> snsLinks) {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername(username);
        List<UpdateProfileRequest.SnsLinkRequest> snsLinkRequests = new ArrayList<>();
        for (String url : snsLinks) {
            snsLinkRequests.add(new UpdateProfileRequest.SnsLinkRequest(url));
        }
        request.setSnsLinks(snsLinkRequests);
        return request;
    }

    private UploadUrlRequest createUploadUrlRequest() {
        return new UploadUrlRequest(FILE_EXTENSION_JPG, CONTENT_TYPE_JPEG);
    }

    private String buildEmailUpdateRequestBody(String newEmail, String currentPassword) {
        return String.format("{\"%s\":\"%s\",\"%s\":\"%s\"}",
            FIELD_NEW_EMAIL, newEmail, FIELD_CURRENT_PASSWORD, currentPassword);
    }

    private String buildPasswordUpdateRequestBody(String currentPassword, String newPassword, String newPasswordConfirm) {
        return String.format("{\"%s\":\"%s\",\"%s\":\"%s\",\"%s\":\"%s\"}",
            FIELD_CURRENT_PASSWORD, currentPassword,
            FIELD_NEW_PASSWORD, newPassword,
            FIELD_NEW_PASSWORD_CONFIRM, newPasswordConfirm);
    }

    private String buildDeleteAccountRequestBody(String password) {
        return String.format("{\"%s\":\"%s\"}", FIELD_PASSWORD, password);
    }

    private String getUserByIdEndpoint(Long userId) {
        return USER_BY_ID_ENDPOINT_PREFIX + userId;
    }

    private String getUserPhotosEndpoint(Long userId) {
        return USER_BY_ID_ENDPOINT_PREFIX + userId + USER_PHOTOS_SUFFIX;
    }

    private String getBearerToken(String token) {
        return "Bearer " + token;
    }

    // Test helper methods for MockMvc operations
    private org.springframework.test.web.servlet.ResultActions performGetMyProfile() throws Exception {
        return mockMvc.perform(get(USER_ME_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken)));
    }

    private org.springframework.test.web.servlet.ResultActions performGetUserProfile(Long userId) throws Exception {
        return mockMvc.perform(get(getUserByIdEndpoint(userId)));
    }

    private org.springframework.test.web.servlet.ResultActions performUpdateProfile(UpdateProfileRequest request) throws Exception {
        return mockMvc.perform(put(USER_PROFILE_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private org.springframework.test.web.servlet.ResultActions performUpdateEmail(String requestBody) throws Exception {
        return mockMvc.perform(put(USER_EMAIL_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody));
    }

    private org.springframework.test.web.servlet.ResultActions performUpdatePassword(String requestBody) throws Exception {
        return mockMvc.perform(put(USER_PASSWORD_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody));
    }

    private org.springframework.test.web.servlet.ResultActions performDeleteAccount(String requestBody) throws Exception {
        return mockMvc.perform(delete(USER_ME_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody));
    }

    // GET /api/v1/users/me のテスト
    @Test
    @DisplayName("GET /api/v1/users/me - 認証済みユーザーの情報を取得")
    void testGetMyProfile_Authenticated_ReturnsUserProfile() throws Exception {
        // SNSリンクを追加
        UserSnsLink link1 = new UserSnsLink(testUser.getId(), SNS_LINK_X);
        UserSnsLink link2 = new UserSnsLink(testUser.getId(), SNS_LINK_INSTAGRAM);
        userSnsLinkRepository.save(link1);
        userSnsLinkRepository.save(link2);

        performGetMyProfile()
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_USER_ID, is(testUser.getId().intValue())))
                .andExpect(jsonPath(JSON_PATH_USERNAME, is(TEST_USERNAME)))
                .andExpect(jsonPath(JSON_PATH_EMAIL, is(TEST_EMAIL)))
                .andExpect(jsonPath(JSON_PATH_PROFILE_IMAGE_URL).value(nullValue()))
                .andExpect(jsonPath(JSON_PATH_SNS_LINKS, hasSize(2)))
                .andExpect(jsonPath(JSON_PATH_SNS_LINK_0_URL, is(SNS_LINK_X)))
                .andExpect(jsonPath(JSON_PATH_SNS_LINK_1_URL, is(SNS_LINK_INSTAGRAM)));
    }

    @Test
    @DisplayName("GET /api/v1/users/me - 未認証の場合は401を返す")
    void testGetMyProfile_Unauthenticated_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get(USER_ME_ENDPOINT))
                .andExpect(status().isUnauthorized());
    }

    // GET /api/v1/users/{userId} のテスト
    @Test
    @DisplayName("GET /api/v1/users/{userId} - 他ユーザーの情報を取得（emailは含まない）")
    void testGetUserProfile_ReturnsUserProfileWithoutEmail() throws Exception {
        performGetUserProfile(testUser.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_USER_ID, is(testUser.getId().intValue())))
                .andExpect(jsonPath(JSON_PATH_USERNAME, is(TEST_USERNAME)))
                .andExpect(jsonPath(JSON_PATH_EMAIL).doesNotExist())
                .andExpect(jsonPath(JSON_PATH_PROFILE_IMAGE_URL).value(nullValue()))
                .andExpect(jsonPath(JSON_PATH_SNS_LINKS, hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/v1/users/{userId} - 存在しないユーザーIDの場合は404を返す")
    void testGetUserProfile_UserNotFound_ReturnsNotFound() throws Exception {
        performGetUserProfile(NON_EXISTENT_USER_ID)
                .andExpect(status().isNotFound());
    }

    // PUT /api/v1/users/me/profile のテスト
    @Test
    @DisplayName("PUT /api/v1/users/me/profile - プロフィール更新成功")
    void testUpdateProfile_ValidRequest_ReturnsUpdatedProfile() throws Exception {
        UpdateProfileRequest request = createUpdateProfileRequest(NEW_USERNAME, List.of(SNS_LINK_NEW_X));

        performUpdateProfile(request)
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_USERNAME, is(NEW_USERNAME)))
                .andExpect(jsonPath(JSON_PATH_SNS_LINKS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SNS_LINK_0_URL, is(SNS_LINK_NEW_X)));
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - ユーザー名重複の場合は409を返す")
    void testUpdateProfile_UsernameConflict_ReturnsConflict() throws Exception {
        // 別のユーザーを作成
        createTestUser(EXISTING_USERNAME, OTHER_EMAIL);

        UpdateProfileRequest request = createUpdateProfileRequest(EXISTING_USERNAME, new ArrayList<>());

        performUpdateProfile(request)
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - バリデーションエラー（ユーザー名が短すぎる）")
    void testUpdateProfile_UsernameTooShort_ReturnsBadRequest() throws Exception {
        UpdateProfileRequest request = createUpdateProfileRequest(INVALID_USERNAME_SHORT, new ArrayList<>());

        performUpdateProfile(request)
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - SNSリンクが最大3件を超える場合は400を返す")
    void testUpdateProfile_TooManySnsLinks_ReturnsBadRequest() throws Exception {
        UpdateProfileRequest request = createUpdateProfileRequest(TEST_USERNAME,
                List.of(SNS_LINK_X, SNS_LINK_INSTAGRAM, SNS_LINK_FACEBOOK, SNS_LINK_LINKEDIN));

        performUpdateProfile(request)
                .andExpect(status().isBadRequest());
    }

    // POST /api/v1/users/me/avatar-upload-url のテスト
    @Test
    @DisplayName("POST /api/v1/users/me/avatar-upload-url - 署名付きURL発行成功")
    void testGetAvatarUploadUrl_ValidRequest_ReturnsUploadUrl() throws Exception {
        UploadUrlRequest request = createUploadUrlRequest();

        mockMvc.perform(post(USER_AVATAR_UPLOAD_URL_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_UPLOAD_URL).exists())
                .andExpect(jsonPath(JSON_PATH_OBJECT_KEY).exists())
                .andExpect(jsonPath(JSON_PATH_OBJECT_KEY, startsWith("avatars/" + testUser.getId())));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/avatar-upload-url - 未認証の場合は401を返す")
    void testGetAvatarUploadUrl_Unauthenticated_ReturnsUnauthorized() throws Exception {
        UploadUrlRequest request = createUploadUrlRequest();

        mockMvc.perform(post(USER_AVATAR_UPLOAD_URL_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    // GET /api/v1/users/{userId}/photos のテスト
    @Test
    @DisplayName("GET /api/v1/users/{userId}/photos - ユーザーの投稿一覧を取得")
    void testGetUserPhotos_ReturnsPhotoList() throws Exception {
        // このテストは写真データが必要なので、後ほど実装する
        mockMvc.perform(get(getUserPhotosEndpoint(testUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT).isArray());
    }

    @Test
    @DisplayName("GET /api/v1/users/{userId}/photos - ページネーション対応")
    void testGetUserPhotos_WithPagination_ReturnsPagedResult() throws Exception {
        mockMvc.perform(get(getUserPhotosEndpoint(testUser.getId()))
                .param(PARAM_PAGE, String.valueOf(PAGE_NUMBER_0))
                .param(PARAM_SIZE, String.valueOf(PAGE_SIZE_20)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT).isArray())
                .andExpect(jsonPath(JSON_PATH_PAGE).exists())
                .andExpect(jsonPath(JSON_PATH_SIZE).exists())
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).exists())
                .andExpect(jsonPath(JSON_PATH_TOTAL_PAGES).exists());
    }

    // ============================================================
    // Issue#20: アカウント設定機能のテスト
    // ============================================================

    // PUT /api/v1/users/me/email のテスト
    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メールアドレス変更成功")
    void testUpdateEmail_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = buildEmailUpdateRequestBody(NEW_EMAIL, TEST_PASSWORD);

        performUpdateEmail(requestBody)
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_EMAIL, is(NEW_EMAIL)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - パスワード誤りの場合は401を返す")
    void testUpdateEmail_WrongPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = buildEmailUpdateRequestBody(NEW_EMAIL, WRONG_PASSWORD);

        performUpdateEmail(requestBody)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString(ERROR_WRONG_PASSWORD)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メールアドレス重複の場合は409を返す")
    void testUpdateEmail_DuplicateEmail_ReturnsConflict() throws Exception {
        // 別のユーザーを作成
        createTestUser(OTHER_USERNAME, OTHER_EMAIL);

        String requestBody = buildEmailUpdateRequestBody(OTHER_EMAIL, TEST_PASSWORD);

        performUpdateEmail(requestBody)
                .andExpect(status().isConflict())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString(ERROR_EMAIL_ALREADY_USED)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - 同じメールアドレスの場合は200を返す")
    void testUpdateEmail_SameEmail_ReturnsOk() throws Exception {
        String requestBody = buildEmailUpdateRequestBody(TEST_EMAIL, TEST_PASSWORD);

        performUpdateEmail(requestBody)
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_EMAIL, is(TEST_EMAIL)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メール形式不正の場合は400を返す")
    void testUpdateEmail_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        String requestBody = buildEmailUpdateRequestBody(INVALID_EMAIL, TEST_PASSWORD);

        performUpdateEmail(requestBody)
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - 未認証の場合は401を返す")
    void testUpdateEmail_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = buildEmailUpdateRequestBody(NEW_EMAIL, TEST_PASSWORD);

        mockMvc.perform(put(USER_EMAIL_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // PUT /api/v1/users/me/password のテスト
    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード変更成功")
    void testUpdatePassword_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD);

        performUpdatePassword(requestBody)
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - 現在のパスワード誤りの場合は401を返す")
    void testUpdatePassword_WrongCurrentPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(WRONG_PASSWORD, NEW_PASSWORD, NEW_PASSWORD);

        performUpdatePassword(requestBody)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString(ERROR_CURRENT_PASSWORD_WRONG)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード不一致の場合は400を返す")
    void testUpdatePassword_PasswordMismatch_ReturnsBadRequest() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, NEW_PASSWORD, DIFFERENT_PASSWORD);

        performUpdatePassword(requestBody)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString(ERROR_PASSWORD_MISMATCH)));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード形式不正の場合は400を返す")
    void testUpdatePassword_InvalidPasswordFormat_ReturnsBadRequest() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, SHORT_PASSWORD, SHORT_PASSWORD);

        performUpdatePassword(requestBody)
                .andExpect(status().isBadRequest());
    }

    // Issue#21: パスワードバリデーション統一 - 記号禁止チェック
    @Test
    @DisplayName("Issue#21 - PUT /api/v1/users/me/password - 記号を含むパスワードの場合は400を返す")
    void testUpdatePassword_PasswordWithSpecialCharacters_ReturnsBadRequest() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, PASSWORD_WITH_SPECIAL, PASSWORD_WITH_SPECIAL);

        performUpdatePassword(requestBody)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS_0_FIELD, is("newPassword")));
    }

    // Issue#21: パスワードバリデーション統一 - 最大文字数チェック
    @Test
    @DisplayName("Issue#21 - PUT /api/v1/users/me/password - 21文字以上のパスワードの場合は400を返す")
    void testUpdatePassword_PasswordTooLong_ReturnsBadRequest() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, PASSWORD_TOO_LONG, PASSWORD_TOO_LONG);

        performUpdatePassword(requestBody)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS_0_FIELD, is("newPassword")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - 未認証の場合は401を返す")
    void testUpdatePassword_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = buildPasswordUpdateRequestBody(TEST_PASSWORD, NEW_PASSWORD, NEW_PASSWORD);

        mockMvc.perform(put(USER_PASSWORD_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // DELETE /api/v1/users/me のテスト
    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - アカウント削除成功")
    void testDeleteAccount_ValidRequest_ReturnsNoContent() throws Exception {
        String requestBody = buildDeleteAccountRequestBody(TEST_PASSWORD);

        performDeleteAccount(requestBody)
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - パスワード誤りの場合は401を返す")
    void testDeleteAccount_WrongPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = buildDeleteAccountRequestBody(WRONG_PASSWORD);

        performDeleteAccount(requestBody)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString(ERROR_WRONG_PASSWORD)));
    }

    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - 未認証の場合は401を返す")
    void testDeleteAccount_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = buildDeleteAccountRequestBody(TEST_PASSWORD);

        mockMvc.perform(delete(USER_ME_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // ============================================================
    // Issue#29: プロフィール機能強化のテスト
    // ============================================================

    // Endpoint Constants for Issue#29
    private static final String PROFILE_IMAGE_PRESIGNED_URL_ENDPOINT = "/api/v1/users/me/profile-image/presigned-url";
    private static final String PROFILE_IMAGE_ENDPOINT = "/api/v1/users/me/profile-image";
    private static final String SNS_LINKS_ENDPOINT = "/api/v1/users/me/sns-links";
    private static final String USERNAME_ENDPOINT = "/api/v1/users/me/username";

    // SNS Platform Constants
    private static final String PLATFORM_TWITTER = "twitter";
    private static final String PLATFORM_INSTAGRAM = "instagram";
    private static final String PLATFORM_YOUTUBE = "youtube";
    private static final String PLATFORM_TIKTOK = "tiktok";

    // SNS URL Constants for Issue#29
    private static final String SNS_URL_YOUTUBE = "https://youtube.com/@testuser";
    private static final String SNS_URL_TIKTOK = "https://tiktok.com/@testuser";

    // --- プロフィール画像 Presigned URL取得 ---
    @Test
    @DisplayName("Issue#29 - POST /api/v1/users/me/profile-image/presigned-url - 署名付きURL発行成功")
    void testGetProfileImagePresignedUrl_ValidRequest_ReturnsUploadUrl() throws Exception {
        String requestBody = "{\"extension\":\"jpg\",\"contentType\":\"image/jpeg\"}";

        mockMvc.perform(post(PROFILE_IMAGE_PRESIGNED_URL_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadUrl").exists())
                .andExpect(jsonPath("$.objectKey").exists());
    }

    @Test
    @DisplayName("Issue#29 - POST /api/v1/users/me/profile-image/presigned-url - 未認証の場合は401を返す")
    void testGetProfileImagePresignedUrl_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"extension\":\"jpg\",\"contentType\":\"image/jpeg\"}";

        mockMvc.perform(post(PROFILE_IMAGE_PRESIGNED_URL_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#29 - POST /api/v1/users/me/profile-image/presigned-url - 不正な拡張子の場合は400を返す")
    void testGetProfileImagePresignedUrl_InvalidExtension_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"extension\":\"exe\",\"contentType\":\"application/octet-stream\"}";

        mockMvc.perform(post(PROFILE_IMAGE_PRESIGNED_URL_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    // --- プロフィール画像登録 ---
    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/profile-image - プロフィール画像キー登録成功")
    void testUpdateProfileImage_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = "{\"objectKey\":\"profile-images/1/test-uuid.jpg\"}";

        mockMvc.perform(put(PROFILE_IMAGE_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileImageUrl").exists());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/profile-image - 未認証の場合は401を返す")
    void testUpdateProfileImage_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"objectKey\":\"profile-images/1/test-uuid.jpg\"}";

        mockMvc.perform(put(PROFILE_IMAGE_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // --- プロフィール画像削除 ---
    @Test
    @DisplayName("Issue#29 - DELETE /api/v1/users/me/profile-image - プロフィール画像削除成功")
    void testDeleteProfileImage_ValidRequest_ReturnsNoContent() throws Exception {
        mockMvc.perform(delete(PROFILE_IMAGE_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Issue#29 - DELETE /api/v1/users/me/profile-image - 未認証の場合は401を返す")
    void testDeleteProfileImage_Unauthenticated_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(delete(PROFILE_IMAGE_ENDPOINT)
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // --- SNSリンク保存 ---
    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - SNSリンク保存成功")
    void testUpdateSnsLinks_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = "{\"snsLinks\":[" +
                "{\"platform\":\"twitter\",\"url\":\"https://x.com/testuser\"}," +
                "{\"platform\":\"instagram\",\"url\":\"https://instagram.com/testuser\"}" +
                "]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snsLinks", hasSize(2)));
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - 4種類のSNSを登録可能")
    void testUpdateSnsLinks_AllPlatforms_ReturnsOk() throws Exception {
        String requestBody = "{\"snsLinks\":[" +
                "{\"platform\":\"twitter\",\"url\":\"https://x.com/testuser\"}," +
                "{\"platform\":\"instagram\",\"url\":\"https://instagram.com/testuser\"}," +
                "{\"platform\":\"youtube\",\"url\":\"https://youtube.com/@testuser\"}," +
                "{\"platform\":\"tiktok\",\"url\":\"https://tiktok.com/@testuser\"}" +
                "]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snsLinks", hasSize(4)));
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - 未対応プラットフォームの場合は400を返す")
    void testUpdateSnsLinks_InvalidPlatform_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"snsLinks\":[" +
                "{\"platform\":\"facebook\",\"url\":\"https://facebook.com/testuser\"}" +
                "]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - URLがプラットフォームと不一致の場合は400を返す")
    void testUpdateSnsLinks_UrlMismatch_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"snsLinks\":[" +
                "{\"platform\":\"twitter\",\"url\":\"https://instagram.com/testuser\"}" +
                "]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - 同一プラットフォームが重複している場合は400を返す")
    void testUpdateSnsLinks_DuplicatePlatform_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"snsLinks\":[" +
                "{\"platform\":\"twitter\",\"url\":\"https://x.com/testuser1\"}," +
                "{\"platform\":\"twitter\",\"url\":\"https://x.com/testuser2\"}" +
                "]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/sns-links - 未認証の場合は401を返す")
    void testUpdateSnsLinks_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"snsLinks\":[]}";

        mockMvc.perform(put(SNS_LINKS_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // --- ユーザー名変更 ---
    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/username - ユーザー名変更成功")
    void testUpdateUsername_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = "{\"username\":\"newusername\"}";

        mockMvc.perform(put(USERNAME_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username", is("newusername")));
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/username - ユーザー名が空の場合は400を返す")
    void testUpdateUsername_EmptyUsername_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"username\":\"\"}";

        mockMvc.perform(put(USERNAME_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/username - ユーザー名が30文字を超える場合は400を返す")
    void testUpdateUsername_TooLongUsername_ReturnsBadRequest() throws Exception {
        String longUsername = "a".repeat(31);
        String requestBody = "{\"username\":\"" + longUsername + "\"}";

        mockMvc.perform(put(USERNAME_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/username - ユーザー名が重複している場合は409を返す")
    void testUpdateUsername_DuplicateUsername_ReturnsConflict() throws Exception {
        // 別のユーザーを作成
        createTestUser("existingname", "existing@example.com");

        String requestBody = "{\"username\":\"existingname\"}";

        mockMvc.perform(put(USERNAME_ENDPOINT)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(jwtToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("Issue#29 - PUT /api/v1/users/me/username - 未認証の場合は401を返す")
    void testUpdateUsername_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"username\":\"newusername\"}";

        mockMvc.perform(put(USERNAME_ENDPOINT)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // --- プロフィール取得（プロフィール画像URL・SNSリンク含む） ---
    @Test
    @DisplayName("Issue#29 - GET /api/v1/users/me - プロフィール画像URLが含まれる")
    void testGetMyProfile_IncludesProfileImageUrl() throws Exception {
        // プロフィール画像を設定したユーザーでテスト
        // Note: この時点ではプロフィール画像設定APIが未実装のため、失敗が期待される
        performGetMyProfile()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileImageUrl").exists());
    }

    @Test
    @DisplayName("Issue#29 - GET /api/v1/users/{userId} - 他ユーザーのプロフィール画像URLが含まれる")
    void testGetUserProfile_IncludesProfileImageUrl() throws Exception {
        performGetUserProfile(testUser.getId())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profileImageUrl").exists());
    }
}
