package com.photlas.backend.controller;

import com.photlas.backend.service.GeoIpService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#106: GeoController（IPアドレスからの国判定エンドポイント）のテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class GeoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GeoIpService geoIpService;

    @Test
    @DisplayName("Issue#106 - 国コードが取得できた場合 200 OK と countryCode が返される")
    public void testGetMyCountry_returnsCountryCode() throws Exception {
        when(geoIpService.getCountryCode(org.mockito.ArgumentMatchers.anyString())).thenReturn("JP");

        mockMvc.perform(get("/api/v1/geo/my-country"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.countryCode").value("JP"));
    }

    @Test
    @DisplayName("Issue#106 - 判定不能時に 200 OK と countryCode: null が返される（500エラーにしない）")
    public void testGetMyCountry_returnsNullWhenUndetermined() throws Exception {
        when(geoIpService.getCountryCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(null);

        mockMvc.perform(get("/api/v1/geo/my-country"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.countryCode").doesNotExist())
                .andExpect(content().json("{\"countryCode\":null}"));
    }

    @Test
    @DisplayName("Issue#106 - 認証なしでアクセスできる")
    public void testGetMyCountry_publicAccess() throws Exception {
        when(geoIpService.getCountryCode(org.mockito.ArgumentMatchers.anyString())).thenReturn("JP");

        // Authorization ヘッダーなしでも 200 OK
        mockMvc.perform(get("/api/v1/geo/my-country"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#106 - X-Forwarded-For ヘッダーがある場合、最初のIPが使用される")
    public void testGetMyCountry_usesFirstIpFromXForwardedFor() throws Exception {
        when(geoIpService.getCountryCode("203.0.113.45")).thenReturn("US");

        mockMvc.perform(get("/api/v1/geo/my-country")
                        .header("X-Forwarded-For", "203.0.113.45, 198.51.100.1, 10.0.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.countryCode").value("US"));

        verify(geoIpService).getCountryCode(eq("203.0.113.45"));
    }

    @Test
    @DisplayName("Issue#106 - X-Forwarded-For ヘッダーがない場合、getRemoteAddr() の値が使用される")
    public void testGetMyCountry_usesRemoteAddrWhenNoXForwardedFor() throws Exception {
        // MockMvc の標準で getRemoteAddr() は "127.0.0.1" を返す
        when(geoIpService.getCountryCode("127.0.0.1")).thenReturn(null);

        mockMvc.perform(get("/api/v1/geo/my-country"))
                .andExpect(status().isOk());

        verify(geoIpService).getCountryCode(eq("127.0.0.1"));
    }

    @Test
    @DisplayName("Issue#106 - X-Forwarded-For が単一IPの場合も正しく処理される")
    public void testGetMyCountry_xForwardedForSingleIp() throws Exception {
        when(geoIpService.getCountryCode("8.8.8.8")).thenReturn("US");

        mockMvc.perform(get("/api/v1/geo/my-country")
                        .header("X-Forwarded-For", "8.8.8.8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.countryCode").value("US"));

        verify(geoIpService).getCountryCode(eq("8.8.8.8"));
    }
}
