package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * UsernameReservedWords のテスト。
 * Issue#98: 大文字小文字無視 + NFKC 正規化後の比較が動作することを確認する。
 */
class UsernameReservedWordsTest {

    @Test
    @DisplayName("Issue#98 - admin は予約語")
    void admin_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("admin"));
    }

    @Test
    @DisplayName("Issue#98 - ADMIN（大文字）は大文字小文字無視で予約語ヒット")
    void ADMIN_isReserved_caseInsensitive() {
        assertTrue(UsernameReservedWords.isReserved("ADMIN"));
    }

    @Test
    @DisplayName("Issue#98 - Admin（混在）は予約語ヒット")
    void Admin_isReserved_mixedCase() {
        assertTrue(UsernameReservedWords.isReserved("Admin"));
    }

    @Test
    @DisplayName("Issue#98 - administrator は予約語")
    void administrator_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("administrator"));
    }

    @Test
    @DisplayName("Issue#98 - photlas は予約語")
    void photlas_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("photlas"));
    }

    @Test
    @DisplayName("Issue#98 - home は予約語")
    void home_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("home"));
    }

    @Test
    @DisplayName("Issue#98 - notifications は予約語")
    void notifications_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("notifications"));
    }

    @Test
    @DisplayName("Issue#98 - no-reply は予約語")
    void noReply_isReserved() {
        assertTrue(UsernameReservedWords.isReserved("no-reply"));
    }

    @Test
    @DisplayName("Issue#98 - admin1 は完全一致しないため予約語ではない")
    void admin1_notReserved() {
        assertFalse(UsernameReservedWords.isReserved("admin1"));
    }

    @Test
    @DisplayName("Issue#98 - tanaka は予約語ではない（通常の表示名）")
    void tanaka_notReserved() {
        assertFalse(UsernameReservedWords.isReserved("tanaka"));
    }

    @Test
    @DisplayName("Issue#98 - user_a3f8b2c は予約語ではない（Issue#81 OAuth 仮表示名形式）")
    void oauth_temp_username_notReserved() {
        assertFalse(UsernameReservedWords.isReserved("user_a3f8b2c"));
    }
}
