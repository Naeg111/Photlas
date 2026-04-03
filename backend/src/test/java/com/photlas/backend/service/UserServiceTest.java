package com.photlas.backend.service;

import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

/**
 * UserServiceのユニットテスト
 * コントローラー統合テストでカバーされないビジネスロジックを検証する。
 */
@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserSnsLinkRepository userSnsLinkRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private JavaMailSender mailSender;

    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Mock
    private S3Service s3Service;

    @Mock
    private SpotRepository spotRepository;

    @Mock
    private PhotoRepository photoRepository;

    @InjectMocks
    private UserService userService;

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

    // ===== SNSリンクバリデーション (updateSnsLinks) =====

    @Test
    @DisplayName("Issue#29 - SNSリンク: 未対応プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_UnsupportedPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("facebook", "https://facebook.com/user")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未対応のプラットフォームです");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: 重複プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_DuplicatePlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("twitter", "https://x.com/user1"),
                new UpdateSnsLinksRequest.SnsLinkRequest("twitter", "https://x.com/user2")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("同じプラットフォームが重複しています");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: プラットフォームとURL不一致でIllegalArgumentException")
    void testUpdateSnsLinks_InvalidUrlForPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("instagram", "https://youtube.com/channel")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + x.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithXUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("twitter", "https://x.com/testuser")
        );

        userService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                "twitter".equals(link.getPlatform()) && "https://x.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + twitter.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithTwitterUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("twitter", "https://twitter.com/testuser")
        );

        userService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                "twitter".equals(link.getPlatform()) && "https://twitter.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン偽装URL（x.com.evil.com）はエラー")
    void testUpdateSnsLinks_DomainSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("twitter", "https://x.com.evil.com/phishing")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: クエリパラメータにドメインを含むURL（evil.com?r=instagram.com）はエラー")
    void testUpdateSnsLinks_QueryParamSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("instagram", "https://evil.com/fake?redirect=instagram.com")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン名に含むURL（notinstagram.com）はエラー")
    void testUpdateSnsLinks_PartialDomainMatch_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest("instagram", "https://notinstagram.com/user")
        );

        assertThatThrownBy(() -> userService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    // ===== メールアドレス変更 (updateEmail) =====

    @Test
    @DisplayName("Issue#20 - メール変更: 同じメールアドレスの場合、即座に現在のメールを返す")
    void testUpdateEmail_SameEmail_ReturnsImmediately() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        String result = userService.updateEmail(TEST_EMAIL, TEST_EMAIL, CURRENT_PASSWORD);

        assertThat(result).isEqualTo(TEST_EMAIL);
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Issue#20 - メール変更: パスワード不一致でUnauthorizedException")
    void testUpdateEmail_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> userService.updateEmail(TEST_EMAIL, OTHER_EMAIL, WRONG_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    @Test
    @DisplayName("Issue#20 - メール変更: 重複メールアドレスでConflictException")
    void testUpdateEmail_DuplicateEmail_ThrowsConflict() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        User existingUser = createMockUser(2L, OTHER_EMAIL, "otheruser");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.findByEmail(OTHER_EMAIL)).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> userService.updateEmail(TEST_EMAIL, OTHER_EMAIL, CURRENT_PASSWORD))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("このメールアドレスはすでに使用されています");
    }

    // ===== パスワード変更 (updatePassword) =====

    @Test
    @DisplayName("Issue#20 - パスワード変更: 新パスワード不一致でIllegalArgumentException")
    void testUpdatePassword_MismatchedNewPasswords_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() ->
                userService.updatePassword(TEST_EMAIL, CURRENT_PASSWORD, NEW_PASSWORD, "DifferentPass1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("新しいパスワードが一致しません");
    }

    @Test
    @DisplayName("Issue#20 - パスワード変更: 現在のパスワード不一致でUnauthorizedException")
    void testUpdatePassword_WrongCurrentPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() ->
                userService.updatePassword(TEST_EMAIL, WRONG_PASSWORD, NEW_PASSWORD, NEW_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("現在のパスワードが正しくありません");
    }

    // ===== アカウント削除 (deleteAccount) =====

    @Test
    @DisplayName("Issue#20 - アカウント削除: パスワード不一致でUnauthorizedException")
    void testDeleteAccount_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> userService.deleteAccount(TEST_EMAIL, WRONG_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    // ===== ログイン (loginUser) =====

    @Test
    @DisplayName("Issue#54 - ログイン: メール未認証でIllegalArgumentException")
    void testLoginUser_UnverifiedEmail_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(false);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> userService.loginUser(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("メールアドレスが認証されていません");
    }

    @Test
    @DisplayName("Issue#54 - ログイン: SUSPENDEDロールでAccountSuspendedException")
    void testLoginUser_SuspendedRole_ThrowsAccountSuspended() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setRole("SUSPENDED");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> userService.loginUser(request))
                .isInstanceOf(AccountSuspendedException.class)
                .hasMessageContaining("アカウントが停止されています");
    }

    // ===== ユーザー名更新 (updateUsername) =====

    @Test
    @DisplayName("Issue#29 - ユーザー名更新: 他ユーザーと同じユーザー名でも更新成功する（重複許可）")
    void testUpdateUsername_DuplicateUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = userService.updateUsername(TEST_EMAIL, DUPLICATE_USERNAME);

        assertThat(result).isEqualTo(DUPLICATE_USERNAME);
        verify(userRepository).save(argThat(u -> DUPLICATE_USERNAME.equals(u.getUsername())));
    }

    @Test
    @DisplayName("Issue#29 - ユーザー名更新: 新しいユーザー名が正常に更新される")
    void testUpdateUsername_NewUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = userService.updateUsername(TEST_EMAIL, NEW_USERNAME);

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

        userService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD);

        // 物理削除が呼ばれていないことを確認
        verify(userRepository, never()).delete(any(User.class));
        // saveが呼ばれ、deleted_atが設定されていることを確認
        verify(userRepository).save(argThat(u ->
                u.getDeletedAt() != null
        ));
    }

    @Test
    @DisplayName("Issue#72 - アカウント削除: ユーザー名がランダム文字列に書き換わり、original_usernameに元の値が保存される")
    void testDeleteAccount_RandomizesUsername_PreservesOriginal() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        userService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD);

        verify(userRepository).save(argThat(u ->
                TEST_USERNAME.equals(u.getOriginalUsername()) &&
                !TEST_USERNAME.equals(u.getUsername()) &&
                u.getUsername().startsWith("d_")
        ));
    }

    @Test
    @DisplayName("Issue#72 - ログイン: 退会済みユーザーはログインできない")
    void testLoginUser_DeletedUser_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setDeletedAt(java.time.LocalDateTime.now());
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> userService.loginUser(request))
                .isInstanceOf(UnauthorizedException.class);
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

        assertThatThrownBy(() -> userService.registerUser(request))
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

        userService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD);

        assertThat(spot.getCreatedByUserId()).isEqualTo(2L);
    }

    // ===== ヘルパーメソッド =====

    private User createMockUser(Long id, String email, String username) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole("USER");
        user.setEmailVerified(true);
        return user;
    }
}
