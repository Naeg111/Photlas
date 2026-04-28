package com.photlas.backend.security;

import com.photlas.backend.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import java.util.Collection;
import java.util.Map;

/**
 * Issue#99 - OIDC フロー（LINE）用の Photlas 独自 {@link OidcUser} 実装。
 *
 * {@link PhotlasOAuth2User} を継承することで、{@link OAuth2LoginSuccessHandler} が
 * {@code instanceof PhotlasOAuth2User} で判定すれば OIDC でも非 OIDC でも同じ経路で
 * {@link User} を取り出せるようにする。
 */
public class PhotlasOidcUser extends PhotlasOAuth2User implements OidcUser {

    private final OidcIdToken idToken;
    private final OidcUserInfo userInfo;

    public PhotlasOidcUser(User user, OidcUser delegate) {
        super(user, delegate.getAttributes());
        this.idToken = delegate.getIdToken();
        this.userInfo = delegate.getUserInfo();
    }

    @Override
    public Map<String, Object> getClaims() {
        return idToken != null ? idToken.getClaims() : Map.of();
    }

    @Override
    public OidcUserInfo getUserInfo() {
        return userInfo;
    }

    @Override
    public OidcIdToken getIdToken() {
        return idToken;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return super.getAuthorities();
    }
}
