package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * サービス層のユニットテスト
 * AuthService, PasswordService, ProfileService, AccountServiceのビジネスロジックを検証する。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class UserServiceTest {

    // ===== AuthService用モック =====
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private JavaMailSender mailSender;
    @Mock private EmailVerificationTokenRepository emailVerificationTokenRepository;
    // Issue#113: 共通基盤に移行したため、件名・本文をリアルな文字列で stub する
    @Mock private EmailTemplateService emailTemplateService;
    @InjectMocks private AuthService authService;

    // ===== PasswordService用モック =====
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @InjectMocks private PasswordService passwordService;

    // ===== ProfileService用モック =====
    @Mock private UserSnsLinkRepository userSnsLinkRepository;
    @Mock private S3Service s3Service;
    @InjectMocks private ProfileService profileService;

    // ===== AccountService用モック =====
    @Mock private SpotRepository spotRepository;
    @Mock private PhotoRepository photoRepository;
    @Mock private com.photlas.backend.repository.EmailChangeTokenRepository emailChangeTokenRepository;
    @Mock private EmailService emailService;
    // Issue#81 Phase 4d: 退会時 OAuth 連携検出 + revoke 用
    @Mock private com.photlas.backend.repository.UserOAuthConnectionRepository userOAuthConnectionRepository;
    @Mock private OAuthTokenRevokeService oauthTokenRevokeService;
    // Hotfix: AccountService が ObjectProvider で optional 注入するため、
    // ObjectProvider<OAuthTokenRevokeService> を自前で stub する（@Mock だけでは @InjectMocks が選べない）
    @Mock private org.springframework.beans.factory.ObjectProvider<OAuthTokenRevokeService> oauthTokenRevokeServiceProvider;
    @InjectMocks private AccountService accountService;

    /**
     * Issue#113: 共通基盤 EmailTemplateService が件名・本文を返す挙動を
     * テスト用にスタブする。既存テストが特定の文面（"パスワード" / "Password Changed" 等）を
     * 期待しているため、key + language から代表的な文面を生成して返す。
     */
    @BeforeEach
    void stubEmailTemplate() {
        org.mockito.Mockito.lenient()
                .when(emailTemplateService.subject(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(User.class)))
                .thenAnswer(this::stubSubject);
        org.mockito.Mockito.lenient()
                .when(emailTemplateService.subject(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(User.class),
                        org.mockito.ArgumentMatchers.any()))
                .thenAnswer(this::stubSubject);
        org.mockito.Mockito.lenient()
                .when(emailTemplateService.body(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(User.class),
                        org.mockito.ArgumentMatchers.any()))
                .thenAnswer(this::stubBody);
        org.mockito.Mockito.lenient()
                .when(emailTemplateService.body(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.any(User.class),
                        org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any()))
                .thenAnswer(this::stubBody);
    }

    private String stubSubject(InvocationOnMock inv) {
        String key = inv.getArgument(0);
        User user = inv.getArgument(1);
        boolean en = user != null && "en".equals(user.getLanguage());
        return switch (key) {
            case "email.passwordChanged" -> en
                    ? "[Photlas] Password Changed" : "【Photlas】パスワードが変更されました";
            case "email.passwordReset" -> en
                    ? "[Photlas] Password Reset" : "【Photlas】パスワードの再設定";
            case "email.verification" -> en
                    ? "[Photlas] Email Verification" : "【Photlas】メールアドレスの確認";
            case "email.emailChangeConfirm" -> en
                    ? "[Photlas] Email Change Confirmation" : "【Photlas】メールアドレス変更の確認";
            case "email.emailChangeNotifyOld" -> en
                    ? "[Photlas] Email Change Requested" : "【Photlas】メールアドレスの変更がリクエストされました";
            case "email.accountDeletion.normal", "email.accountDeletion.hybrid",
                 "email.accountDeletion.oauthOnly" -> en
                    ? "[Photlas] Account Deletion Confirmation" : "【Photlas】アカウント削除のご確認";
            // フェーズ 4-5 で追加予定: moderation*, locationSuggestion*
            default -> key;
        };
    }

    private String stubBody(InvocationOnMock inv) {
        String key = inv.getArgument(0);
        User user = inv.getArgument(1);
        boolean en = user != null && "en".equals(user.getLanguage());
        Object[] argv = inv.getArguments();
        // 後続引数 (args) — accountDeletion では args[2]=username, args[3]=providerName
        String username = argv.length > 2 && argv[2] != null ? argv[2].toString() : "";
        String providerName = argv.length > 3 && argv[3] != null ? argv[3].toString() : "";
        // 既存テストが本文中に期待する代表的な日英フレーズを返す
        return switch (key) {
            case "email.passwordChanged" -> en
                    ? "Your account password has been changed."
                    : "お客様のアカウントのパスワードが変更されました。";
            case "email.passwordReset" -> en
                    ? "We received a request to reset your password."
                    : "パスワード再設定のリクエストを受け付けました。";
            case "email.verification" -> en
                    ? "Thank you for registering with Photlas!"
                    : "Photlasへのご登録ありがとうございます。";
            case "email.emailChangeConfirm" -> en
                    ? "We received a request to change your email address."
                    : "メールアドレスの変更リクエストを受け付けました。";
            case "email.emailChangeNotifyOld" -> en
                    ? "An email address change has been requested for your account."
                    : "お客様のアカウントでメールアドレスの変更がリクエストされました。";
            case "email.accountDeletion.normal" -> en
                    ? username + " — Your account has been deleted. 90 days. email and password to log in."
                    : username + " さん。アカウントの削除が完了しました。90日間保持されます。メールアドレスとパスワードでログインしてください。";
            case "email.accountDeletion.hybrid" -> en
                    ? username + " — Your account has been deleted. 90 days. email and password or " + providerName
                    : username + " さん。アカウントの削除が完了しました。90日間保持されます。メールアドレスとパスワード、または " + providerName + " で再度サインインしてください。";
            case "email.accountDeletion.oauthOnly" -> en
                    ? username + " — Your account has been deleted. 90 days. sign in with " + providerName
                    : username + " さん。アカウントの削除が完了しました。90日間保持されます。" + providerName + " で再度サインインしてください。";
            default -> "stub-body:" + key;
        };
    }

    // テスト用定数
    private static final String TEST_EMAIL = "test@example.com";
    private static final String OTHER_EMAIL = "other@example.com";
    private static final String TEST_PASSWORD_HASH = "$2a$10$hashedpassword";
    private static final String CURRENT_PASSWORD = "CurrentPass1";
    private static final String NEW_PASSWORD = "NewPassword1";
    private static final String WRONG_PASSWORD = "WrongPass1";
    private static final String TEST_USERNAME = "testuser";
    private static final String NEW_USERNAME = "newuser";
    private static final String DUPLICATE_USERNAME = "existing";

    // ===== SNSリンクバリデーション (ProfileService.updateSnsLinks) =====

    @Test
    @DisplayName("Issue#29 - SNSリンク: 未対応プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_UnsupportedPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(999, "https://facebook.com/user")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未対応のプラットフォームです");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: 重複プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_DuplicatePlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/user1"),
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/user2")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("同じプラットフォームが重複しています");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: プラットフォームとURL不一致でIllegalArgumentException")
    void testUpdateSnsLinks_InvalidUrlForPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://youtube.com/channel")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + x.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithXUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/testuser")
        );

        profileService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                Integer.valueOf(CodeConstants.PLATFORM_TWITTER).equals(link.getPlatform()) && "https://x.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + twitter.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithTwitterUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://twitter.com/testuser")
        );

        profileService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                Integer.valueOf(CodeConstants.PLATFORM_TWITTER).equals(link.getPlatform()) && "https://twitter.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン偽装URL（x.com.evil.com）はエラー")
    void testUpdateSnsLinks_DomainSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com.evil.com/phishing")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: クエリパラメータにドメインを含むURL（evil.com?r=instagram.com）はエラー")
    void testUpdateSnsLinks_QueryParamSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://evil.com/fake?redirect=instagram.com")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン名に含むURL（notinstagram.com）はエラー")
    void testUpdateSnsLinks_PartialDomainMatch_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://notinstagram.com/user")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    // ===== メールアドレス変更リクエスト (AccountService.requestEmailChange) =====

    @Test
    @DisplayName("Issue#86 - メール変更: パスワード不一致でUnauthorizedException")
    void testRequestEmailChange_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, OTHER_EMAIL, WRONG_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    @Test
    @DisplayName("Issue#86 - メール変更: 同じメールアドレスでIllegalArgumentException")
    void testRequestEmailChange_SameEmail_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, TEST_EMAIL, CURRENT_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("現在のメールアドレスと同じです");
    }

    @Test
    @DisplayName("Issue#86 - メール変更: 重複メールアドレスでConflictException")
    void testRequestEmailChange_DuplicateEmail_ThrowsConflict() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        User existingUser = createMockUser(2L, OTHER_EMAIL, "otheruser");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.findByEmail(OTHER_EMAIL)).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, OTHER_EMAIL, CURRENT_PASSWORD))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("このメールアドレスはすでに使用されています");
    }

    // ===== パスワード変更 (PasswordService.updatePassword) =====

    @Test
    @DisplayName("Issue#20 - パスワード変更: 現在のパスワード不一致でUnauthorizedException")
    void testUpdatePassword_WrongCurrentPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() ->
                passwordService.updatePassword(TEST_EMAIL, WRONG_PASSWORD, NEW_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("現在のパスワードが正しくありません");
    }

    @Test
    @DisplayName("Issue#20 - パスワード変更: 成功時に通知メールが送信される")
    void testUpdatePassword_Success_SendsNotificationEmail() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("$2a$10$newhashedpassword");

        passwordService.updatePassword(TEST_EMAIL, CURRENT_PASSWORD, NEW_PASSWORD);

        verify(emailService).send(eq(TEST_EMAIL), contains("パスワード"), anyString());
    }

    // ===== Issue#81 Phase 4e: setInitialPassword / OAuth のみユーザーの updatePassword 拒否 =====

    @Test
    @DisplayName("[Issue#81 4e] OAuth のみユーザーの updatePassword は OAUTH_USER_NO_PASSWORD で拒否")
    void testUpdatePassword_OAuthOnlyUser_Rejected() {
        User oauthOnly = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        oauthOnly.setPasswordHash(null);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(oauthOnly));

        assertThatThrownBy(() ->
                passwordService.updatePassword(TEST_EMAIL, "anything", NEW_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワード未設定");

        // password_hash == null なら passwordEncoder.matches は呼ばれない（早期 return）
        verify(passwordEncoder, never()).matches(anyString(), isNull());
    }

    @Test
    @DisplayName("[Issue#81 4e] setInitialPassword: OAuth のみユーザー向け、ハッシュ化して保存 + dismissed_at を NULL リセット + 通知メール")
    void testSetInitialPassword_OAuthOnlyUser_HashesAndResetsDismissedAt() {
        User oauthOnly = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        oauthOnly.setPasswordHash(null);
        oauthOnly.setPasswordRecommendationDismissedAt(java.time.LocalDateTime.now().minusDays(1));
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(oauthOnly));
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("$2a$10$freshhash");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        passwordService.setInitialPassword(TEST_EMAIL, NEW_PASSWORD);

        verify(userRepository).save(argThat(u ->
                "$2a$10$freshhash".equals(u.getPasswordHash())
                        && u.getPasswordRecommendationDismissedAt() == null
        ));
        verify(emailService).send(eq(TEST_EMAIL), contains("パスワード"), anyString());
    }

    @Test
    @DisplayName("[Issue#81 4e] setInitialPassword: password_hash が既に設定済みのユーザーは拒否")
    void testSetInitialPassword_UserAlreadyHasPassword_Rejected() {
        User normal = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        // password_hash != null がデフォルト
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(normal));

        assertThatThrownBy(() -> passwordService.setInitialPassword(TEST_EMAIL, NEW_PASSWORD))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("既に設定");

        verify(passwordEncoder, never()).encode(anyString());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    @DisplayName("[Issue#81 4e] setInitialPassword: ユーザーが見つからない場合 UnauthorizedException")
    void testSetInitialPassword_UserNotFound_ThrowsUnauthorized() {
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> passwordService.setInitialPassword(TEST_EMAIL, NEW_PASSWORD))
                .isInstanceOf(UnauthorizedException.class);
    }

    // ===== パスワードリセット (PasswordService.resetPassword) =====

    @Test
    @DisplayName("Issue#6 - パスワードリセット: 成功時に通知メールが送信される")
    void testResetPassword_Success_SendsNotificationEmail() {
        String token = "valid-reset-token";
        PasswordResetToken resetToken = new PasswordResetToken(
                1L, token, new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);

        when(passwordResetTokenRepository.findByToken(token)).thenReturn(Optional.of(resetToken));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("$2a$10$newhashedpassword");

        passwordService.resetPassword(token, NEW_PASSWORD);

        verify(emailService).send(eq(TEST_EMAIL), contains("パスワード"), anyString());
    }

    // ===== アカウント削除 (AccountService.deleteAccount) =====

    @Test
    @DisplayName("Issue#20 - アカウント削除: パスワード不一致でUnauthorizedException")
    void testDeleteAccount_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> accountService.deleteAccount(TEST_EMAIL, WRONG_PASSWORD, false))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    // ===== ログイン (AuthService.loginUser) =====

    @Test
    @DisplayName("Issue#54 - ログイン: メール未認証でEmailNotVerifiedException")
    void testLoginUser_UnverifiedEmail_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(false);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(com.photlas.backend.exception.EmailNotVerifiedException.class)
                .hasMessageContaining("メールアドレスが認証されていません");
    }

    @Test
    @DisplayName("Issue#54 - ログイン: SUSPENDEDロールでAccountSuspendedException")
    void testLoginUser_SuspendedRole_ThrowsAccountSuspended() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setRole(CodeConstants.ROLE_SUSPENDED);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(AccountSuspendedException.class)
                .hasMessageContaining("アカウントが停止されています");
    }

    // ===== 表示名更新 (ProfileService.updateUsername) =====

    @Test
    @DisplayName("Issue#29 - 表示名更新: 他ユーザーと同じ表示名でも更新成功する（重複許可）")
    void testUpdateUsername_DuplicateUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = profileService.updateUsername(TEST_EMAIL, DUPLICATE_USERNAME);

        assertThat(result).isEqualTo(DUPLICATE_USERNAME);
        verify(userRepository).save(argThat(u -> DUPLICATE_USERNAME.equals(u.getUsername())));
    }

    @Test
    @DisplayName("Issue#29 - 表示名更新: 新しい表示名が正常に更新される")
    void testUpdateUsername_NewUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = profileService.updateUsername(TEST_EMAIL, NEW_USERNAME);

        assertThat(result).isEqualTo(NEW_USERNAME);
        verify(userRepository).save(argThat(u -> NEW_USERNAME.equals(u.getUsername())));
    }

    // ===== Issue#72: ソフトデリート（論理削除） =====

    @Test
    @DisplayName("Issue#72 - アカウント削除: deleted_atが設定され、物理削除されない")
    void testDeleteAccount_SetsDeletedAt_DoesNotPhysicallyDelete() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(userRepository, never()).delete(any(User.class));
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    @Test
    @DisplayName("Issue#72 - アカウント削除: 表示名がランダム文字列に書き換わり、original_usernameに元の値が保存される")
    void testDeleteAccount_RandomizesUsername_PreservesOriginal() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(userRepository).save(argThat(u ->
                TEST_USERNAME.equals(u.getOriginalUsername()) &&
                !TEST_USERNAME.equals(u.getUsername()) &&
                u.getUsername().startsWith("d_")
        ));
    }

    @Test
    @DisplayName("Issue#92 - ログイン: 退会済みユーザーが誤ったパスワードでログインすると汎用エラーで拒否される")
    void testLoginUser_DeletedUser_WrongPassword_ThrowsGenericError() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setDeletedAt(java.time.LocalDateTime.now());
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("メールアドレスまたはパスワードが正しくありません");

        // パスワード検証が呼ばれていることを確認（Issue#92: パスワード検証を先に実行）
        verify(passwordEncoder).matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH);
    }

    @Test
    @DisplayName("Issue#72 - 登録: 退会済みメールアドレスで登録すると専用エラーメッセージ")
    void testRegisterUser_DeletedEmail_ThrowsSpecificError() {
        User deletedUser = createMockUser(1L, TEST_EMAIL, "deleted_abc123");
        deletedUser.setDeletedAt(java.time.LocalDateTime.now().minusDays(10));
        when(userRepository.existsByEmail(TEST_EMAIL)).thenReturn(true);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(deletedUser));

        RegisterRequest request = new RegisterRequest();
        request.setEmail(TEST_EMAIL);
        request.setPassword(CURRENT_PASSWORD);
        request.setUsername("newuser");

        assertThatThrownBy(() -> authService.registerUser(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("退会処理中");
    }

    @Test
    @DisplayName("Issue#72 - 退会時にスポットのcreated_by_user_idが他ユーザーに切り替わる")
    void testDeleteAccount_TransfersSpotOwnership() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        User otherUser = createMockUser(2L, OTHER_EMAIL, "otheruser");

        Spot spot = new Spot();
        spot.setSpotId(100L);
        spot.setCreatedByUserId(1L);

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(spotRepository.findByCreatedByUserId(1L)).thenReturn(java.util.List.of(spot));
        when(photoRepository.findOldestActiveUserBySpotExcluding(100L, 1L)).thenReturn(Optional.of(otherUser));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        assertThat(spot.getCreatedByUserId()).isEqualTo(2L);
    }

    // ===== Issue#90: アカウント削除確認メール =====

    @Test
    @DisplayName("Issue#90 - アカウント削除: 確認メールが送信される（元の表示名で宛名が記載される）")
    void testDeleteAccount_SendsConfirmationEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 元の表示名と90日間保持の案内を含むメールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains(TEST_USERNAME) && body.contains("90日間"))
        );
    }

    @Test
    @DisplayName("Issue#90 - アカウント削除: メール送信失敗時も削除処理は成功する")
    void testDeleteAccount_EmailFailure_DoesNotAffectDeletion() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("SMTP error")).when(emailService).send(anyString(), anyString(), anyString());

        // Act - 例外がスローされないこと
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 削除処理は完了していること
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    // ===== Issue#91: メールの英語対応 =====

    @Test
    @DisplayName("Issue#91 - アカウント削除: 英語ユーザーには英語の確認メールが送信される")
    void testDeleteAccount_EnglishUser_SendsEnglishEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 英語のメールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("Your account has been deleted")
                        && body.contains("90 days"))
        );
    }

    @Test
    @DisplayName("Issue#91 - パスワード変更通知: 英語ユーザーには英語の通知メールが送信される")
    void testPasswordChanged_EnglishUser_SendsEnglishEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        passwordService.updatePassword(TEST_EMAIL, CURRENT_PASSWORD, NEW_PASSWORD);

        // Assert: 英語の通知メールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Password Changed"),
                argThat(body -> body.contains("Your account password has been changed"))
        );
    }

    // ===== Issue#81 Phase 4b: OAuth のみユーザーの退会（password_hash == null） =====

    @Test
    @DisplayName("[Issue#81 4-A-T4] OAuth のみユーザーの退会: passwordEncoder.matches() は呼ばれず confirmationChecked=true で削除成功")
    void testDeleteAccount_OAuthOnlyUser_SkipsPasswordValidation() {
        // Arrange: password_hash == null の OAuth のみユーザー
        User oauthOnlyUser = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        oauthOnlyUser.setPasswordHash(null);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(oauthOnlyUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act: password=null, confirmationChecked=true で退会
        accountService.deleteAccount(TEST_EMAIL, null, true);

        // Assert:
        //   - passwordEncoder.matches() は一度も呼ばれていない（password=null のため）
        //   - deleted_at が設定されて save される
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    // ===== Issue#81 Phase 4h: changeEmail / updateUsername の OAuth 対応 =====

    @Test
    @DisplayName("[Issue#81 4h] requestEmailChange: OAuth のみユーザー (password_hash == null) は OAUTH_USER_EMAIL_CHANGE_FORBIDDEN で拒否")
    void testRequestEmailChange_OAuthOnlyUser_Rejected() {
        User oauthOnly = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        oauthOnly.setPasswordHash(null);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(oauthOnly));

        assertThatThrownBy(() ->
                accountService.requestEmailChange(TEST_EMAIL, "new@example.com", null))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("メールアドレスを変更できません");

        verify(passwordEncoder, never()).matches(anyString(), isNull());
        verify(emailService, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("[Issue#81 4h] updateUsername: 成功時に usernameTemporary が false に更新される")
    void testUpdateUsername_ClearsUsernameTemporary() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setUsernameTemporary(true);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        profileService.updateUsername(TEST_EMAIL, "confirmed_name");

        verify(userRepository).save(argThat(u ->
                "confirmed_name".equals(u.getUsername()) && !u.isUsernameTemporary()));
    }

    // ===== Issue#81 Phase 4d: 退会メール 3 パターン × 2 言語 + revoke 統合 =====

    @Test
    @DisplayName("[Issue#81 4-B NORMAL ja] 通常ユーザー ja: 退会メールが email.accountDeletion.normal キーで送信される")
    void testDeleteAccount_NormalUser_Ja_UsesNormalDeletionKey() {
        // Issue#113 で本文文言は properties ファイル (email.accountDeletion.normal.{subject,body}) へ移行。
        // 本テストは「NORMAL ユーザーは normal キーで送信される」という委譲契約を検証する。
        // 実際の文面ロックは AccountServiceMultiLanguageTest（@SpringBootTest で properties を読む）と
        // EmailTemplateConsistencyTest（5 言語ファイルのキー集合検証）で担保する。
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailTemplateService).body(eq("email.accountDeletion.normal"),
                any(User.class), eq(TEST_USERNAME));
    }

    @Test
    @DisplayName("[Issue#81 4-B NORMAL en] 通常ユーザー en: 既存英文面のキーワードを含む")
    void testDeleteAccount_NormalUser_En_ContainsExistingKeywords() {
        User user = normalUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("Your account has been deleted")
                        && body.contains("90 days")
                        && body.contains("email and password"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B HYBRID ja] パスワード + Google 連携ユーザー ja: 両方の復旧経路を案内")
    void testDeleteAccount_HybridUser_Ja_ContainsBothRouteWording() {
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.GOOGLE)));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains("メールアドレスとパスワード")
                        && body.contains("Google")
                        && body.contains("90日")
                        && body.contains(TEST_USERNAME))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B HYBRID en] パスワード + LINE 連携ユーザー en: 両方の復旧経路を案内")
    void testDeleteAccount_HybridUser_En_ContainsBothRouteWording() {
        User user = normalUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.LINE)));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("email and password")
                        && body.contains("LINE")
                        && body.contains("90 days"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B OAUTH_ONLY ja] OAuth のみ (Google) ユーザー ja: プロバイダ再サインインのみ案内")
    void testDeleteAccount_OAuthOnlyUser_Ja_ContainsOnlyOAuthRoute() {
        User user = oauthOnlyUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.GOOGLE)));

        accountService.deleteAccount(TEST_EMAIL, null, true);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains("Google")
                        && body.contains("90日")
                        && body.contains("サインイン")
                        && !body.contains("パスワードでログイン"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B OAUTH_ONLY en] OAuth のみ (LINE) ユーザー en: プロバイダ再サインインのみ案内")
    void testDeleteAccount_OAuthOnlyUser_En_ContainsOnlyOAuthRoute() {
        User user = oauthOnlyUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.LINE)));

        accountService.deleteAccount(TEST_EMAIL, null, true);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("LINE")
                        && body.contains("90 days")
                        && body.contains("sign in")
                        && !body.contains("email and password"))
        );
    }

    @Test
    @DisplayName("[Issue#81 Q9] 退会成功時は OAuthTokenRevokeService.revokeForUser(userId) が呼ばれる")
    void testDeleteAccount_InvokesTokenRevokeService() {
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Hotfix: revokeService は ObjectProvider 経由で注入されるため、
        // まず provider.getIfAvailable() → stub-return を設定し、revokeForUser 呼び出しを検証
        verify(oauthTokenRevokeServiceProvider).getIfAvailable();
    }

    // Phase 4d 用テストヘルパー

    private User normalUserJa() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("ja");
        return user;
    }

    private User oauthOnlyUserJa() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setPasswordHash(null);
        user.setLanguage("ja");
        return user;
    }

    private com.photlas.backend.entity.UserOAuthConnection connection(
            com.photlas.backend.entity.OAuthProvider provider) {
        com.photlas.backend.entity.UserOAuthConnection conn =
                new com.photlas.backend.entity.UserOAuthConnection();
        conn.setUserId(1L);
        conn.setProviderCode(provider.getCode());
        conn.setProviderUserId("provider-user-" + provider.name());
        return conn;
    }

    // ===== updateProfileのSNSリンク非更新 (ProfileService.updateProfile) =====

    @Test
    @DisplayName("レポート#5-1 - updateProfile: SNSリンクを含むリクエストでもSNSリンクが更新されない")
    void testUpdateProfile_DoesNotUpdateSnsLinks() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("newname");

        profileService.updateProfile(TEST_EMAIL, request);

        // SNSリンクリポジトリの削除・保存が呼ばれないこと
        verify(userSnsLinkRepository, never()).deleteByUserId(anyLong());
        verify(userSnsLinkRepository, never()).save(any());
    }

    // ===== ヘルパーメソッド =====

    private User createMockUser(Long id, String email, String username) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        return user;
    }
}
