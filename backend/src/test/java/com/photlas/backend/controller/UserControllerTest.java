package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UploadUrlRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

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
}
