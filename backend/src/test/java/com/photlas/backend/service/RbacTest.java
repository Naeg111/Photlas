package com.photlas.backend.service;

import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import com.photlas.backend.filter.RateLimitFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#54: ロールベースアクセス制御（RBAC）テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class RbacTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User adminUser;
    private User normalUser;
    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        userRepository.deleteAll();

        adminUser = new User();
        adminUser.setUsername("admin");
        adminUser.setEmail("admin@example.com");
        adminUser.setPasswordHash("hashedpassword");
        adminUser.setRole("ADMIN");
        adminUser = userRepository.save(adminUser);

        normalUser = new User();
        normalUser.setUsername("user");
        normalUser.setEmail("user@example.com");
        normalUser.setPasswordHash("hashedpassword");
        normalUser.setRole("USER");
        normalUser = userRepository.save(normalUser);

        // Issue#54: ロール情報をJWTに含めてトークン生成
        adminToken = jwtService.generateTokenWithRole(adminUser.getEmail(), "ADMIN");
        userToken = jwtService.generateTokenWithRole(normalUser.getEmail(), "USER");
    }

    @Test
    @DisplayName("Issue#54 - 管理者は管理者APIにアクセスできる")
    void testAdminEndpoint_WithAdminRole_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/moderation/queue")
                .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#54 - 一般ユーザーは管理者APIにアクセスできない")
    void testAdminEndpoint_WithUserRole_Returns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/moderation/queue")
                .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Issue#54 - 未認証ユーザーは管理者APIにアクセスできない")
    void testAdminEndpoint_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/moderation/queue"))
                .andExpect(status().isUnauthorized());
    }
}
