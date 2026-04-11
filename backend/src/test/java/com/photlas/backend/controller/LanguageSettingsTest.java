package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#93: 言語設定変更API テスト
 * PUT /api/v1/users/me/language
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class LanguageSettingsTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User testUser;
    private String jwtToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        rateLimitFilter.clearCache();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash(passwordEncoder.encode("Password123"));
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser.setEmailVerified(true);
        testUser.setLanguage("ja");
        testUser = userRepository.save(testUser);

        jwtToken = jwtService.generateToken(testUser.getEmail());
    }

    // ===== 言語設定変更 =====

    @ParameterizedTest
    @ValueSource(strings = {"ja", "en", "ko", "zh-CN", "zh-TW"})
    @DisplayName("Issue#93 - 有効な言語コードで言語設定が更新される")
    void testUpdateLanguage_ValidLanguage_ReturnsOk(String language) throws Exception {
        mockMvc.perform(put("/api/v1/users/me/language")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"language\": \"" + language + "\"}"))
                .andExpect(status().isOk());

        User updated = userRepository.findByEmail("test@example.com").orElseThrow();
        assertThat(updated.getLanguage()).isEqualTo(language);
    }

    @ParameterizedTest
    @ValueSource(strings = {"fr", "de", "th", "es", "invalid", ""})
    @DisplayName("Issue#93 - 無効な言語コードは400エラーで拒否される")
    void testUpdateLanguage_InvalidLanguage_ReturnsBadRequest(String language) throws Exception {
        mockMvc.perform(put("/api/v1/users/me/language")
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"language\": \"" + language + "\"}"))
                .andExpect(status().isBadRequest());

        // 言語設定が変更されていないことを確認
        User unchanged = userRepository.findByEmail("test@example.com").orElseThrow();
        assertThat(unchanged.getLanguage()).isEqualTo("ja");
    }

    @Test
    @DisplayName("Issue#93 - 未認証ユーザーは言語設定を変更できない")
    void testUpdateLanguage_Unauthenticated_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(put("/api/v1/users/me/language")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"language\": \"en\"}"))
                .andExpect(status().isUnauthorized());
    }
}
