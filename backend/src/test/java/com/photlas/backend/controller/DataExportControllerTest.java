package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#108 §4.1 - DataExportController のテスト。
 *
 * 範囲:
 *   - POST /api/v1/users/me/export
 *   - 200 OK + ZIP ストリーミング + 適切なヘッダー
 *   - 401 Unauthorized: パスワード不一致
 *   - 200 OK: OAuth のみユーザーは password 不要
 *   - 409 Conflict: 同時実行中
 *   - 429 Too Many Requests + Retry-After: 168 時間以内に成功エクスポート済み
 *   - 400 Bad Request: password が 101 文字以上
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class DataExportControllerTest {

    private static final String ENDPOINT = "/api/v1/users/me/export";
    private static final String EMAIL = "exporter@example.com";
    private static final String PASSWORD_PLAIN = "TestPass1";

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtService jwtService;

    @MockBean private S3Service s3Service;

    private String userToken;
    private Long userId;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        User user = new User("exporter", EMAIL,
                encoder.encode(PASSWORD_PLAIN), CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setLanguage("ja");
        user = userRepository.save(user);
        userId = user.getId();
        userToken = jwtService.generateTokenWithRole(EMAIL, "USER");

        when(s3Service.downloadObjectAsBytes(anyString())).thenReturn(new byte[]{0x01, 0x02});
    }

    @Test
    @DisplayName("Issue#108 - 正しいパスワードで 200 OK + 適切なヘッダー（application/zip / Content-Disposition / Cache-Control / X-Accel-Buffering）")
    void exportWithCorrectPasswordReturnsZip() throws Exception {
        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + PASSWORD_PLAIN + "\"}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", containsString("application/zip")))
                .andExpect(header().string("Content-Disposition",
                        startsWith("attachment; filename=\"photlas-export-" + userId + "-")))
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(header().string("X-Accel-Buffering", "no"));
    }

    @Test
    @DisplayName("Issue#108 - パスワード誤りは 401 Unauthorized")
    void exportWithWrongPasswordReturns401() throws Exception {
        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"WrongPass1\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#108 - password 101 文字は 400 Bad Request（DoS 防止）")
    void exportWithOversizedPasswordReturns400() throws Exception {
        String oversized = "a".repeat(101);
        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + oversized + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#108 - OAuth のみユーザー（passwordHash null）は password 省略でも 200 OK")
    void oauthOnlyUserCanExportWithoutPassword() throws Exception {
        // OAuth のみユーザーをセットアップ
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        User oauthUser = new User("oauthonly", "oauth@example.com", null, CodeConstants.ROLE_USER);
        oauthUser.setEmailVerified(true);
        oauthUser.setLanguage("ja");
        oauthUser = userRepository.save(oauthUser);
        String oauthToken = jwtService.generateTokenWithRole("oauth@example.com", "USER");

        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + oauthToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#108 - 直近成功エクスポートあり: 429 Too Many Requests + Retry-After ヘッダー")
    void recentlyExportedUserReceives429WithRetryAfter() throws Exception {
        User u = userRepository.findById(userId).orElseThrow();
        u.setLastExportedAt(java.time.LocalDateTime.now().minusHours(1));
        userRepository.saveAndFlush(u);

        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + PASSWORD_PLAIN + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("Issue#108 - 同時実行ロック中（exportInProgressAt セット）: 409 Conflict")
    void inProgressExportReturns409() throws Exception {
        User u = userRepository.findById(userId).orElseThrow();
        u.setExportInProgressAt(java.time.LocalDateTime.now());
        userRepository.saveAndFlush(u);

        mockMvc.perform(post(ENDPOINT)
                        .with(csrf())
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"" + PASSWORD_PLAIN + "\"}"))
                .andExpect(status().isConflict());
    }
}
