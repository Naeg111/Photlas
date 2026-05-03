package com.photlas.backend.dto.export;

import java.util.List;

/**
 * Issue#108: ユーザーのエクスポート対象データ全体を保持する DTO。
 *
 * <p>ユーザー向けエクスポート（DataExportService）と管理者向けエクスポート
 * （AdminDeletedUserController#exportData）の両方で利用される。</p>
 *
 * <p>すべての配列フィールドは対象データが 0 件でも空リストを返す
 * （null にしないこと。JSON 出力時に空配列として表現するため）。</p>
 */
public record UserExportData(
        UserInfo user,
        List<PhotoInfo> photos,
        List<FavoriteInfo> favorites,
        List<SnsLinkInfo> snsLinks,
        List<OAuthConnectionInfo> oauthConnections,
        List<ReportInfo> reports,
        List<SanctionInfo> sanctions,
        List<ViolationInfo> violations,
        List<LocationSuggestionInfo> locationSuggestions,
        List<SpotInfo> spots
) {}
