package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;

import com.photlas.backend.entity.*;
import com.photlas.backend.repository.*;
import com.photlas.backend.service.JwtService;
import com.photlas.backend.service.S3Service;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#73: 退会済みユーザー管理コントローラーのテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AdminDeletedUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private S3Service s3Service;

    private static final String ADMIN_EMAIL = "admin@example.com";
    private static final String ADMIN_ROLE = "ADMIN";
    private static final String ENDPOINT = "/api/v1/admin/deleted-users";

    private String adminToken;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        User admin = new User("adminuser", ADMIN_EMAIL,
                new BCryptPasswordEncoder().encode("AdminPass1"), CodeConstants.ROLE_ADMIN);
        admin.setEmailVerified(true);
        userRepository.save(admin);
        adminToken = jwtService.generateTokenWithRole(ADMIN_EMAIL, ADMIN_ROLE);
    }

    @Test
    @DisplayName("Issue#73 - 退会済みユーザー一覧を取得できる")
    void testGetDeletedUsers_ReturnsDeletedUsers() throws Exception {
        User deleted = createDeletedUser("deleted@example.com", "deleteduser", 10);

        mockMvc.perform(get(ENDPOINT)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].email", is("deleted@example.com")))
                .andExpect(jsonPath("$.content[0].original_username", is("deleteduser")));
    }

    @Test
    @DisplayName("Issue#73 - メールアドレスで検索できる")
    void testGetDeletedUsers_SearchByEmail() throws Exception {
        createDeletedUser("target@example.com", "target", 10);
        createDeletedUser("other@example.com", "other", 5);

        mockMvc.perform(get(ENDPOINT)
                        .header("Authorization", "Bearer " + adminToken)
                        .param("search", "target"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].email", is("target@example.com")));
    }

    @Test
    @DisplayName("Issue#73 - 退会済みユーザー詳細を取得できる")
    void testGetDeletedUserDetail_ReturnsDetail() throws Exception {
        User deleted = createDeletedUser("detail@example.com", "detailuser", 10);

        mockMvc.perform(get(ENDPOINT + "/" + deleted.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("detail@example.com")))
                .andExpect(jsonPath("$.original_username", is("detailuser")));
    }

    @Test
    @DisplayName("Issue#73 - 即時削除: メールアドレス確認で物理削除される")
    void testImmediateDelete_WithEmailConfirmation() throws Exception {
        User deleted = createDeletedUser("purge@example.com", "purgeuser", 10);
        Long userId = deleted.getId();

        mockMvc.perform(delete(ENDPOINT + "/" + userId)
                        .with(csrf())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm_email\": \"purge@example.com\"}"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Issue#73 - 即時削除: メールアドレス不一致で拒否される")
    void testImmediateDelete_WrongEmail_Returns400() throws Exception {
        User deleted = createDeletedUser("purge@example.com", "purgeuser", 10);

        mockMvc.perform(delete(ENDPOINT + "/" + deleted.getId())
                        .with(csrf())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"confirm_email\": \"wrong@example.com\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#73 - 保持期間延長: deletion_hold_untilが設定される")
    void testSetHold_SetsHoldDate() throws Exception {
        User deleted = createDeletedUser("hold@example.com", "holduser", 10);

        mockMvc.perform(post(ENDPOINT + "/" + deleted.getId() + "/hold")
                        .with(csrf())
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hold_until\": \"2027-06-01T00:00:00\"}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#73 - データエクスポート: JSONが返される")
    void testExport_ReturnsJson() throws Exception {
        User deleted = createDeletedUser("export@example.com", "exportuser", 10);

        mockMvc.perform(get(ENDPOINT + "/" + deleted.getId() + "/export")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email", is("export@example.com")));
    }

    private User createDeletedUser(String email, String originalUsername, int daysAgo) {
        // ユーザー名は@Size(max=12)制約があるため12文字以内にする
        String shortId = String.valueOf(System.nanoTime() % 100000);
        User user = new User("del_" + shortId, email,
                new BCryptPasswordEncoder().encode("Pass1234"), CodeConstants.ROLE_USER);
        user.setDeletedAt(LocalDateTime.now().minusDays(daysAgo));
        user.setOriginalUsername(originalUsername);
        return userRepository.save(user);
    }
}
