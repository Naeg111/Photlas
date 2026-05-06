package com.photlas.backend.controller;

import com.photlas.backend.config.SecurityConfig;
import com.photlas.backend.filter.XRobotsTagFilter;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * RobotsTxtController のテスト。
 *
 * <p>API ホスト（api.photlas.jp / test-api.photlas.jp）の /robots.txt が
 * 認証なしで Disallow:/ を返し、X-Robots-Tag ヘッダも noindex で付与されることを検証する。</p>
 */
@WebMvcTest(RobotsTxtController.class)
@Import({SecurityConfig.class, XRobotsTagFilter.class})
class RobotsTxtControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtService jwtService;

    @Test
    @DisplayName("/robots.txt は認証なしで 200 OK を返す")
    void robotsTxt_returns200_withoutAuth() throws Exception {
        mockMvc.perform(get("/robots.txt"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("/robots.txt は Disallow: / を返してクロールを禁止する")
    void robotsTxt_returnsDisallowAll() throws Exception {
        mockMvc.perform(get("/robots.txt"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("User-agent: *")))
                .andExpect(content().string(containsString("Disallow: /")));
    }

    @Test
    @DisplayName("/robots.txt は text/plain で返される")
    void robotsTxt_returnsTextPlain() throws Exception {
        mockMvc.perform(get("/robots.txt"))
                .andExpect(content().contentTypeCompatibleWith("text/plain"));
    }

    @Test
    @DisplayName("全レスポンスに X-Robots-Tag: noindex, nofollow ヘッダが付与される")
    void allResponses_haveXRobotsTagHeader() throws Exception {
        mockMvc.perform(get("/robots.txt"))
                .andExpect(header().string("X-Robots-Tag", "noindex, nofollow"));
    }
}
