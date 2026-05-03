package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: OAuth 連携情報。oauth.json に対応する。
 *
 * <p>provider は OAuthProvider.registrationId（"google" / "line"）の文字列を返す。
 * トークンや provider_user_id は含めない（セキュリティ・プライバシー観点）。</p>
 */
public record OAuthConnectionInfo(String provider, String email, Instant connectedAt) {}
