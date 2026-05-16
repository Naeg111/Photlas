package com.photlas.backend.controller;

import com.photlas.backend.service.SpotService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#141 Phase 2: {@code GET /api/v1/spots} の {@code tag_ids} クエリパラメータが
 * {@link SpotService#getSpots} に正しく届くことを検証する。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SpotControllerTagIdsTest {

    @Autowired private MockMvc mockMvc;
    @MockBean private SpotService spotService;

    private static final String SPOTS_URL = "/api/v1/spots";

    @Test
    @DisplayName("Issue#141 - GET /spots?tag_ids=1&tag_ids=2: SpotService.getSpots に tagIds=[1,2] が渡される")
    void getSpots_passesTagIdsToService() throws Exception {
        when(spotService.getSpots(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get(SPOTS_URL)
                        .param("north", "90")
                        .param("south", "-90")
                        .param("east", "180")
                        .param("west", "-180")
                        .param("tag_ids", "1")
                        .param("tag_ids", "2"))
                .andExpect(status().isOk());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Long>> tagIdsCaptor =
                (ArgumentCaptor<List<Long>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(List.class);
        verify(spotService).getSpots(any(BigDecimal.class), any(BigDecimal.class),
                any(BigDecimal.class), any(BigDecimal.class),
                any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(),
                tagIdsCaptor.capture());
        assertThat(tagIdsCaptor.getValue()).containsExactly(1L, 2L);
    }

    @Test
    @DisplayName("Issue#141 - GET /spots (tag_ids 未指定): SpotService.getSpots に tagIds=null が渡される")
    void getSpots_omitsTagIds_passesNull() throws Exception {
        when(spotService.getSpots(any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any())).thenReturn(List.of());

        mockMvc.perform(get(SPOTS_URL)
                        .param("north", "90")
                        .param("south", "-90")
                        .param("east", "180")
                        .param("west", "-180"))
                .andExpect(status().isOk());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<Long>> tagIdsCaptor =
                (ArgumentCaptor<List<Long>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(List.class);
        verify(spotService).getSpots(any(BigDecimal.class), any(BigDecimal.class),
                any(BigDecimal.class), any(BigDecimal.class),
                any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(),
                tagIdsCaptor.capture());
        assertThat(tagIdsCaptor.getValue()).isNull();
    }
}
