package com.photlas.backend.entity;

/**
 * Issue#81 - OAuth プロバイダー列挙型。
 *
 * 数値コード: 1401=GOOGLE, 1402=LINE（CodeConstants 他フィールドとの衝突回避のため 1400 番台）。
 * Spring Security OAuth2 Client の registrationId ("google" / "line") と対応する。
 */
public enum OAuthProvider {

    GOOGLE(1401, "google"),
    LINE(1402, "line");

    private final int code;
    private final String registrationId;

    OAuthProvider(int code, String registrationId) {
        this.code = code;
        this.registrationId = registrationId;
    }

    public int getCode() {
        return code;
    }

    public String getRegistrationId() {
        return registrationId;
    }

    /**
     * 数値コードから enum 値を逆引きする。
     *
     * @param code 1401 または 1402
     * @return 対応する OAuthProvider
     * @throws IllegalArgumentException 未定義コードのとき
     */
    public static OAuthProvider fromCode(int code) {
        for (OAuthProvider provider : values()) {
            if (provider.code == code) {
                return provider;
            }
        }
        throw new IllegalArgumentException("不明な OAuthProvider コード: " + code);
    }

    /**
     * Spring Security の registrationId から enum 値を逆引きする。
     *
     * @param registrationId "google" または "line"
     * @return 対応する OAuthProvider
     * @throws IllegalArgumentException 未定義 registrationId のとき
     */
    public static OAuthProvider fromRegistrationId(String registrationId) {
        for (OAuthProvider provider : values()) {
            if (provider.registrationId.equals(registrationId)) {
                return provider;
            }
        }
        throw new IllegalArgumentException("不明な OAuthProvider registrationId: " + registrationId);
    }
}
