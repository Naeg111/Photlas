package com.photlas.backend.entity;

/**
 * Issue#81 Phase 2 - OAuth プロバイダー列挙型（Red 段階のスケルトン）
 *
 * TDD Red 段階のため、コードと registrationId の対応は未実装（呼び出すと例外）。
 * Green 段階で GOOGLE=1401 / LINE=1402、registrationId "google" / "line" を実装する。
 */
public enum OAuthProvider {
    GOOGLE,
    LINE;

    public int getCode() {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public String getRegistrationId() {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public static OAuthProvider fromCode(int code) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public static OAuthProvider fromRegistrationId(String registrationId) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }
}
