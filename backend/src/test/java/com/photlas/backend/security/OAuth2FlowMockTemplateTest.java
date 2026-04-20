package com.photlas.backend.security;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#81 Phase 3f - OAuth2 フロー全体の MockMvc 雛形テスト（手順書 Round 12 / [2-H] パターン 3）。
 *
 * <p>手順書 [2-H] で定められた 3 パターンの OAuth2 テストモック戦略のうち、本クラスは:
 * <ul>
 *   <li><b>パターン 1</b>（helper 単体）: {@code OAuth2UserServiceHelperTest} で実装済</li>
 *   <li><b>パターン 2</b>（MockMvc の {@code oauth2Login()} post-processor）: Phase 4 以降のコントローラテストで実装</li>
 *   <li><b>パターン 3</b>（{@code @MockBean} で {@link OAuth2UserServiceHelper} を差し替えてフィルタチェインだけ通す）: <b>本クラス</b></li>
 * </ul>
 *
 * <p>パターン 3 は「実プロバイダー API を叩かずに Spring Security の OAuth2 フィルタチェインが
 * 期待通りに動作することを検証する」ためのもの。本クラスは最小構成の雛形であり、
 * 後続の Phase で認可→コールバック→成功ハンドラまで一気通貫のケースに拡張できる。
 *
 * <p>拡張の手引き:
 * <ol>
 *   <li>{@link OAuth2UserServiceHelper#processOAuthUser} を stub してテスト用 {@link User} を返させる</li>
 *   <li>MockMvc でコールバック URL に state/code 付きリクエストを送る（{@code /api/v1/auth/oauth2/callback/*}）</li>
 *   <li>{@link OAuth2LoginSuccessHandler} が {@code /oauth/callback#access_token=...} にリダイレクトするのを検証</li>
 * </ol>
 * <p>ただしコールバック段階は Spring Security の {@code OAuth2LoginAuthenticationFilter} 内で
 * トークンエンドポイントへの HTTP 呼び出しが発生するため、実際は {@code DefaultAuthorizationCodeTokenResponseClient}
 * の差し替えも必要。本雛形では「認可リダイレクトを叩いたときに helper は呼ばれない」という
 * 最小限の契約のみ検証する。
 */
@SpringBootTest(properties = {
        "photlas.oauth.enabled=true",
        "spring.security.oauth2.client.registration.google.client-id=dummy-google-id",
        "spring.security.oauth2.client.registration.google.client-secret=dummy-google-secret",
        "spring.security.oauth2.client.registration.google.scope=email,profile",
        "spring.security.oauth2.client.registration.google.redirect-uri={baseUrl}/api/v1/auth/oauth2/callback/google",
        "spring.security.oauth2.client.registration.line.client-id=dummy-line-id",
        "spring.security.oauth2.client.registration.line.client-secret=dummy-line-secret",
        "spring.security.oauth2.client.registration.line.scope=profile,openid,email",
        "spring.security.oauth2.client.registration.line.authorization-grant-type=authorization_code",
        "spring.security.oauth2.client.registration.line.redirect-uri={baseUrl}/api/v1/auth/oauth2/callback/line",
        "spring.security.oauth2.client.registration.line.client-authentication-method=client_secret_post",
        "spring.security.oauth2.client.provider.line.authorization-uri=https://access.line.me/oauth2/v2.1/authorize",
        "spring.security.oauth2.client.provider.line.token-uri=https://api.line.me/oauth2/v2.1/token",
        "spring.security.oauth2.client.provider.line.user-info-uri=https://api.line.me/v2/profile",
        "spring.security.oauth2.client.provider.line.user-name-attribute=userId"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("Issue#81 Phase 3f - OAuth2 フロー全体の雛形テスト（[2-H] パターン 3）")
class OAuth2FlowMockTemplateTest {

    @Autowired
    private MockMvc mockMvc;

    /** 後続テストがここで返す {@link User} を差し替えて「helper が呼ばれた」ケースを組み立てる。 */
    @MockBean
    private OAuth2UserServiceHelper oAuth2UserServiceHelper;

    @Test
    @DisplayName("雛形: 認可リダイレクト段階では helper は呼ばれない（プロバイダ呼び出し前）")
    void authorizationRedirect_doesNotInvokeHelper() throws Exception {
        mockMvc.perform(get("/api/v1/auth/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection());
        verifyNoInteractions(oAuth2UserServiceHelper);
    }

    @Test
    @DisplayName("雛形: helper の戻り値を stub するユーティリティが機能する（拡張用サンプル）")
    void helperStub_returnsMockedUser() {
        // 後続テストでコールバックまで通す場合の stub 雛形。本テストは「組み立てが成立する」ことだけ確認する。
        User stubbed = new User("user_abc1234", "mock@example.com", null, CodeConstants.ROLE_USER);
        stubbed.setId(999L);
        stubbed.setEmailVerified(true);
        when(oAuth2UserServiceHelper.processOAuthUser(any(OAuth2UserInfo.class))).thenReturn(stubbed);

        User result = oAuth2UserServiceHelper.processOAuthUser(
                new OAuth2UserInfo(
                        com.photlas.backend.entity.OAuthProvider.GOOGLE,
                        "provider-user-id",
                        "mock@example.com",
                        "stub-access-token",
                        null,
                        "ja"
                )
        );

        org.assertj.core.api.Assertions.assertThat(result).isSameAs(stubbed);
    }
}
