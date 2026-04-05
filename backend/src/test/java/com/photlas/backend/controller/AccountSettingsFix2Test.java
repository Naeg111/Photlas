package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * アカウント設定精査レポート #6, #7 の修正テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AccountSettingsFix2Test {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimitFilter rateLimitFilter;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash(passwordEncoder.encode("Password123"));
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser.setEmailVerified(true);
        testUser = userRepository.save(testUser);

        jwtToken = jwtService.generateTokenWithRole("test@example.com", "USER");
    }

    // ===== #6: SNSリンク最大件数の統一 =====

    @Test
    @DisplayName("#6 - PUT /api/v1/users/me/profile でSNSリンク4件が登録できる")
    void testUpdateProfile_4SnsLinks_ReturnsOk() throws Exception {
        String requestBody = """
            {
              "username": "testuser",
              "snsLinks": [
                {"url": "https://x.com/user1"},
                {"url": "https://instagram.com/user1"},
                {"url": "https://youtube.com/user1"},
                {"url": "https://tiktok.com/@user1"}
              ]
            }
            """;

        mockMvc.perform(put("/api/v1/users/me/profile")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk());
    }

}
