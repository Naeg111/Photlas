package com.photlas.backend.security;

import com.photlas.backend.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

/**
 * Issue#81 Phase 3c - Photlas 独自の {@link OAuth2User} 実装。
 *
 * Spring Security の認証チェーン上で {@link OAuth2User} として扱われるが、
 * 内部に Photlas の {@link User} エンティティを保持し、
 * {@link com.photlas.backend.security.OAuth2LoginSuccessHandler} から
 * JWT 発行時にそのまま取り出せるようにする。
 */
public class PhotlasOAuth2User implements OAuth2User {

    private final User user;
    private final Map<String, Object> attributes;

    public PhotlasOAuth2User(User user, Map<String, Object> attributes) {
        this.user = user;
        this.attributes = attributes == null ? Collections.emptyMap() : Map.copyOf(attributes);
    }

    public User getUser() {
        return user;
    }

    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        String roleName = com.photlas.backend.entity.CodeConstants.roleToJwtString(user.getRole());
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + roleName));
    }

    @Override
    public String getName() {
        // OAuth2User.getName() は nameAttributeKey で指定した attribute の値を返すのが慣例だが、
        // Photlas では User のメールアドレスを「名前」として扱う（内部ユーザー識別子）。
        return user.getEmail();
    }
}
