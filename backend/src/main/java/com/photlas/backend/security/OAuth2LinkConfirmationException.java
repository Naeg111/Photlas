package com.photlas.backend.security;

import com.photlas.backend.entity.OAuthProvider;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

/**
 * Issue#99 - OAuth 認証時に既存メールアカウントとのリンク確認が必要な場合に投げる例外。
 *
 * <p>{@link OAuth2AuthenticationException} を継承するが、汎用エラー扱いではなく
 * {@link OAuth2LoginFailureHandler} がこの型を検出した場合は
 * {@code #link_confirmation_token=<token>&provider=<PROVIDER>} 形式で
 * フロントエンドにリダイレクトする。短命トークンは
 * {@code OAuthLinkConfirmationService.issue(...)} で発行された値を保持する。
 *
 * <p>エラーコードは {@code OAUTH_LINK_CONFIRMATION_REQUIRED}（基底クラスの
 * {@link OAuth2Error} に格納）。失敗ハンドラがこの型を認識できなかった場合の
 * フォールバックとして、フロントエンドの i18n でも同名キーをハンドリングする。
 */
public class OAuth2LinkConfirmationException extends OAuth2AuthenticationException {

    /** 失敗ハンドラ・i18n で使用するエラーコード。 */
    public static final String ERROR_CODE = "OAUTH_LINK_CONFIRMATION_REQUIRED";

    private final String linkConfirmationToken;
    private final OAuthProvider provider;

    public OAuth2LinkConfirmationException(String linkConfirmationToken, OAuthProvider provider) {
        super(new OAuth2Error(ERROR_CODE,
                        "既存アカウントが検出されました。リンク確認が必要です", null),
                ERROR_CODE);
        this.linkConfirmationToken = linkConfirmationToken;
        this.provider = provider;
    }

    /** {@code OAuthLinkConfirmationService.issue(...)} が発行した生トークン（hex 64 文字）。 */
    public String getLinkConfirmationToken() {
        return linkConfirmationToken;
    }

    /** リンク確認対象のプロバイダ（Google / LINE）。 */
    public OAuthProvider getProvider() {
        return provider;
    }
}
