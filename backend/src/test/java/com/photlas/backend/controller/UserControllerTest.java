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

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        userSnsLinkRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User("testuser", "test@example.com", passwordEncoder.encode("password"), "USER");
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        jwtToken = jwtService.generateToken(testUser.getEmail());

        // S3Serviceのモック設定
        when(s3Service.generateCdnUrl(anyString())).thenAnswer(invocation -> {
            String s3Key = invocation.getArgument(0);
            if (s3Key == null) {
                return null;
            }
            return "https://test-bucket.s3.us-east-1.amazonaws.com/" + s3Key;
        });

        when(s3Service.generatePresignedUploadUrl(anyString(), anyLong(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String folder = invocation.getArgument(0);
                    Long userId = invocation.getArgument(1);
                    String extension = invocation.getArgument(2);
                    String objectKey = String.format("%s/%d/test-uuid.%s", folder, userId, extension);
                    String uploadUrl = "https://test-bucket.s3.us-east-1.amazonaws.com/" + objectKey + "?signature=test";
                    return new S3Service.UploadUrlResult(uploadUrl, objectKey);
                });
    }

    // GET /api/v1/users/me のテスト
    @Test
    @DisplayName("GET /api/v1/users/me - 認証済みユーザーの情報を取得")
    void testGetMyProfile_Authenticated_ReturnsUserProfile() throws Exception {
        // SNSリンクを追加
        UserSnsLink link1 = new UserSnsLink(testUser.getId(), "https://x.com/testuser");
        UserSnsLink link2 = new UserSnsLink(testUser.getId(), "https://instagram.com/testuser");
        userSnsLinkRepository.save(link1);
        userSnsLinkRepository.save(link2);

        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId", is(testUser.getId().intValue())))
                .andExpect(jsonPath("$.username", is("testuser")))
                .andExpect(jsonPath("$.email", is("test@example.com")))
                .andExpect(jsonPath("$.profileImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.snsLinks", hasSize(2)))
                .andExpect(jsonPath("$.snsLinks[0].url", is("https://x.com/testuser")))
                .andExpect(jsonPath("$.snsLinks[1].url", is("https://instagram.com/testuser")));
    }

    @Test
    @DisplayName("GET /api/v1/users/me - 未認証の場合は401を返す")
    void testGetMyProfile_Unauthenticated_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isUnauthorized());
    }

    // GET /api/v1/users/{userId} のテスト
    @Test
    @DisplayName("GET /api/v1/users/{userId} - 他ユーザーの情報を取得（emailは含まない）")
    void testGetUserProfile_ReturnsUserProfileWithoutEmail() throws Exception {
        mockMvc.perform(get("/api/v1/users/" + testUser.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId", is(testUser.getId().intValue())))
                .andExpect(jsonPath("$.username", is("testuser")))
                .andExpect(jsonPath("$.email").doesNotExist())
                .andExpect(jsonPath("$.profileImageUrl").value(nullValue()))
                .andExpect(jsonPath("$.snsLinks", hasSize(0)));
    }

    @Test
    @DisplayName("GET /api/v1/users/{userId} - 存在しないユーザーIDの場合は404を返す")
    void testGetUserProfile_UserNotFound_ReturnsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/users/99999"))
                .andExpect(status().isNotFound());
    }

    // PUT /api/v1/users/me/profile のテスト
    @Test
    @DisplayName("PUT /api/v1/users/me/profile - プロフィール更新成功")
    void testUpdateProfile_ValidRequest_ReturnsUpdatedProfile() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("newusername");

        List<UpdateProfileRequest.SnsLinkRequest> snsLinks = new ArrayList<>();
        snsLinks.add(new UpdateProfileRequest.SnsLinkRequest("https://x.com/newuser"));
        request.setSnsLinks(snsLinks);

        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username", is("newusername")))
                .andExpect(jsonPath("$.snsLinks", hasSize(1)))
                .andExpect(jsonPath("$.snsLinks[0].url", is("https://x.com/newuser")));
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - ユーザー名重複の場合は409を返す")
    void testUpdateProfile_UsernameConflict_ReturnsConflict() throws Exception {
        // 別のユーザーを作成
        User otherUser = new User("existinguser", "other@example.com", passwordEncoder.encode("password"), "USER");
        userRepository.save(otherUser);

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("existinguser"); // 既存のユーザー名
        request.setSnsLinks(new ArrayList<>());

        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - バリデーションエラー（ユーザー名が短すぎる）")
    void testUpdateProfile_UsernameTooShort_ReturnsBadRequest() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("a"); // 1文字（最小2文字）
        request.setSnsLinks(new ArrayList<>());

        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("PUT /api/v1/users/me/profile - SNSリンクが最大3件を超える場合は400を返す")
    void testUpdateProfile_TooManySnsLinks_ReturnsBadRequest() throws Exception {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("testuser");

        List<UpdateProfileRequest.SnsLinkRequest> snsLinks = new ArrayList<>();
        snsLinks.add(new UpdateProfileRequest.SnsLinkRequest("https://x.com/user"));
        snsLinks.add(new UpdateProfileRequest.SnsLinkRequest("https://instagram.com/user"));
        snsLinks.add(new UpdateProfileRequest.SnsLinkRequest("https://facebook.com/user"));
        snsLinks.add(new UpdateProfileRequest.SnsLinkRequest("https://linkedin.com/user")); // 4件目
        request.setSnsLinks(snsLinks);

        mockMvc.perform(put("/api/v1/users/me/profile")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // POST /api/v1/users/me/avatar-upload-url のテスト
    @Test
    @DisplayName("POST /api/v1/users/me/avatar-upload-url - 署名付きURL発行成功")
    void testGetAvatarUploadUrl_ValidRequest_ReturnsUploadUrl() throws Exception {
        UploadUrlRequest request = new UploadUrlRequest("jpg", "image/jpeg");

        mockMvc.perform(post("/api/v1/users/me/avatar-upload-url")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadUrl").exists())
                .andExpect(jsonPath("$.objectKey").exists())
                .andExpect(jsonPath("$.objectKey", startsWith("avatars/" + testUser.getId())));
    }

    @Test
    @DisplayName("POST /api/v1/users/me/avatar-upload-url - 未認証の場合は401を返す")
    void testGetAvatarUploadUrl_Unauthenticated_ReturnsUnauthorized() throws Exception {
        UploadUrlRequest request = new UploadUrlRequest("jpg", "image/jpeg");

        mockMvc.perform(post("/api/v1/users/me/avatar-upload-url")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    // GET /api/v1/users/{userId}/photos のテスト
    @Test
    @DisplayName("GET /api/v1/users/{userId}/photos - ユーザーの投稿一覧を取得")
    void testGetUserPhotos_ReturnsPhotoList() throws Exception {
        // このテストは写真データが必要なので、後ほど実装する
        mockMvc.perform(get("/api/v1/users/" + testUser.getId() + "/photos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @DisplayName("GET /api/v1/users/{userId}/photos - ページネーション対応")
    void testGetUserPhotos_WithPagination_ReturnsPagedResult() throws Exception {
        mockMvc.perform(get("/api/v1/users/" + testUser.getId() + "/photos")
                .param("page", "0")
                .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.page").exists())
                .andExpect(jsonPath("$.size").exists())
                .andExpect(jsonPath("$.totalElements").exists())
                .andExpect(jsonPath("$.totalPages").exists());
    }

    // ============================================================
    // Issue#20: アカウント設定機能のテスト
    // ============================================================

    // PUT /api/v1/users/me/email のテスト
    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メールアドレス変更成功")
    void testUpdateEmail_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = "{\"new_email\":\"newemail@example.com\",\"current_password\":\"password\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("newemail@example.com")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - パスワード誤りの場合は401を返す")
    void testUpdateEmail_WrongPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"new_email\":\"newemail@example.com\",\"current_password\":\"wrongpassword\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("パスワードが正しくありません")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メールアドレス重複の場合は409を返す")
    void testUpdateEmail_DuplicateEmail_ReturnsConflict() throws Exception {
        // 別のユーザーを作成
        User otherUser = new User("otheruser", "other@example.com", passwordEncoder.encode("password"), "USER");
        userRepository.save(otherUser);

        String requestBody = "{\"new_email\":\"other@example.com\",\"current_password\":\"password\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message", containsString("このメールアドレスはすでに使用されています")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - 同じメールアドレスの場合は200を返す")
    void testUpdateEmail_SameEmail_ReturnsOk() throws Exception {
        String requestBody = "{\"new_email\":\"test@example.com\",\"current_password\":\"password\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("test@example.com")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - メール形式不正の場合は400を返す")
    void testUpdateEmail_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"new_email\":\"invalid-email\",\"current_password\":\"password\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/email - 未認証の場合は401を返す")
    void testUpdateEmail_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"new_email\":\"newemail@example.com\",\"current_password\":\"password\"}";

        mockMvc.perform(put("/api/v1/users/me/email")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // PUT /api/v1/users/me/password のテスト
    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード変更成功")
    void testUpdatePassword_ValidRequest_ReturnsOk() throws Exception {
        String requestBody = "{\"current_password\":\"password\",\"new_password\":\"NewPass123\",\"new_password_confirm\":\"NewPass123\"}";

        mockMvc.perform(put("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - 現在のパスワード誤りの場合は401を返す")
    void testUpdatePassword_WrongCurrentPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"current_password\":\"wrongpassword\",\"new_password\":\"NewPass123\",\"new_password_confirm\":\"NewPass123\"}";

        mockMvc.perform(put("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("現在のパスワードが正しくありません")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード不一致の場合は400を返す")
    void testUpdatePassword_PasswordMismatch_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"current_password\":\"password\",\"new_password\":\"NewPass123\",\"new_password_confirm\":\"DifferentPass123\"}";

        mockMvc.perform(put("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("新しいパスワードが一致しません")));
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - パスワード形式不正の場合は400を返す")
    void testUpdatePassword_InvalidPasswordFormat_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"current_password\":\"password\",\"new_password\":\"short\",\"new_password_confirm\":\"short\"}";

        mockMvc.perform(put("/api/v1/users/me/password")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#20 - PUT /api/v1/users/me/password - 未認証の場合は401を返す")
    void testUpdatePassword_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"current_password\":\"password\",\"new_password\":\"NewPass123\",\"new_password_confirm\":\"NewPass123\"}";

        mockMvc.perform(put("/api/v1/users/me/password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    // DELETE /api/v1/users/me のテスト
    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - アカウント削除成功")
    void testDeleteAccount_ValidRequest_ReturnsNoContent() throws Exception {
        String requestBody = "{\"password\":\"password\"}";

        mockMvc.perform(delete("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - パスワード誤りの場合は401を返す")
    void testDeleteAccount_WrongPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"password\":\"wrongpassword\"}";

        mockMvc.perform(delete("/api/v1/users/me")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("パスワードが正しくありません")));
    }

    @Test
    @DisplayName("Issue#20 - DELETE /api/v1/users/me - 未認証の場合は401を返す")
    void testDeleteAccount_Unauthenticated_ReturnsUnauthorized() throws Exception {
        String requestBody = "{\"password\":\"password\"}";

        mockMvc.perform(delete("/api/v1/users/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }
}
