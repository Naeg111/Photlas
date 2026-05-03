package com.photlas.backend.service;

import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.EmailVerificationToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.EmailNotVerifiedException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.LanguageUtils;
import com.photlas.backend.util.TokenGenerator;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.Optional;

/**
 * 認証サービス
 * ユーザー登録、ログイン、メール認証のビジネスロジックを提供する。
 */
@Service
public class AuthService {

    private static final int EMAIL_VERIFICATION_TOKEN_EXPIRATION_HOURS = 24;
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_INVALID_CREDENTIALS = "メールアドレスまたはパスワードが正しくありません";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final EmailTemplateService emailTemplateService;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            EmailVerificationTokenRepository emailVerificationTokenRepository,
            EmailTemplateService emailTemplateService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.emailTemplateService = emailTemplateService;
    }

    /**
     * ユーザー登録処理
     * メール認証トークンを生成し、認証メールを送信する。
     *
     * @param request 登録リクエスト
     * @return 登録レスポンス
     */
    @Transactional
    public RegisterResponse registerUser(RegisterRequest request, String acceptLanguage) {
        String normalizedEmail = request.getEmail().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
            if (existingUser.isPresent() && existingUser.get().getDeletedAt() != null) {
                throw new ConflictException("このメールアドレスは退会処理中のため、現在ご利用いただけません");
            }
            throw new ConflictException("このメールアドレスは既に登録されています");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(
            request.getUsername(),
            normalizedEmail,
            hashedPassword,
            CodeConstants.ROLE_USER
        );
        user.setLanguage(LanguageUtils.resolve(acceptLanguage));

        // Issue#104 + Issue#109: メール+パスワード登録時は利用規約・プライバシーポリシー・年齢確認を同意済みとして記録
        // (RegisterRequest の @AssertTrue により、各 boolean が true であることはバリデーション済み)
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        user.setTermsAgreedAt(now);
        user.setPrivacyPolicyAgreedAt(now);
        user.setAgeConfirmedAt(now);

        user = userRepository.save(user);

        sendVerificationEmail(user);

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            null
        );
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Transactional
    public RegisterResponse registerUser(RegisterRequest request) {
        return registerUser(request, null);
    }

    /**
     * ログイン処理
     * Issue#92: ソフトデリート済みユーザーが正しいパスワードでログインした場合、アカウントを復旧する。
     *
     * @param request ログインリクエスト
     * @return ログインレスポンス
     */
    @Transactional
    public RegisterResponse loginUser(LoginRequest request, String acceptLanguage) {
        Optional<User> userOptional = userRepository.findByEmail(request.getEmail().toLowerCase());

        if (userOptional.isEmpty()) {
            throw new UnauthorizedException(ERROR_INVALID_CREDENTIALS);
        }

        User user = userOptional.get();

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException(ERROR_INVALID_CREDENTIALS);
        }

        // Issue#92: ソフトデリート済みの場合、アカウントを復旧する
        if (user.getDeletedAt() != null) {
            recoverSoftDeletedUser(user);
        }

        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException("メールアドレスが認証されていません。認証メール内のリンクをクリックしてください。");
        }

        if (Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(user.getRole())) {
            throw new AccountSuspendedException("アカウントが停止されています");
        }

        // Issue#93: ログイン時のAccept-Languageによる言語自動更新を廃止
        // 言語設定はユーザーが手動で変更する

        String token = jwtService.generateTokenWithRole(user.getEmail(), CodeConstants.roleToJwtString(user.getRole()));

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    public RegisterResponse loginUser(LoginRequest request) {
        return loginUser(request, null);
    }

    /**
     * メールアドレスを認証する
     *
     * @param token 認証トークン
     */
    @Transactional
    public void verifyEmail(String token) {
        Optional<EmailVerificationToken> tokenOptional =
                emailVerificationTokenRepository.findByToken(token);

        if (tokenOptional.isEmpty()) {
            throw new IllegalArgumentException("認証トークンが無効または期限切れです");
        }

        EmailVerificationToken verificationToken = tokenOptional.get();

        if (verificationToken.getExpiryDate().before(new Date())) {
            emailVerificationTokenRepository.delete(verificationToken);
            throw new IllegalArgumentException("認証トークンが無効または期限切れです");
        }

        Optional<User> userOptional = userRepository.findById(verificationToken.getUserId());
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException(ERROR_USER_NOT_FOUND);
        }

        User user = userOptional.get();
        user.setEmailVerified(true);
        userRepository.save(user);

        emailVerificationTokenRepository.delete(verificationToken);
    }

    /**
     * 認証メールを再送信する
     *
     * @param email メールアドレス
     */
    @Transactional
    public void resendVerificationEmail(String email) {
        Optional<User> userOptional = userRepository.findByEmail(email.toLowerCase());

        if (userOptional.isEmpty()) {
            return;
        }

        User user = userOptional.get();

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("このメールアドレスは既に認証済みです");
        }

        sendVerificationEmail(user);
    }

    /**
     * Issue#92: ソフトデリート済みアカウントを復旧する
     * deletedAt, username, originalUsername, deletionHoldUntilをリストアする。
     *
     * Issue#81 Phase 3b: 可視性を private → package-private に変更し、
     * 同パッケージの OAuth2UserServiceHelper から呼び出せるようにする。
     */
    void recoverSoftDeletedUser(User user) {
        user.setDeletedAt(null);
        user.setUsername(user.getOriginalUsername());
        user.setOriginalUsername(null);
        user.setDeletionHoldUntil(null);
        userRepository.save(user);
    }

    /**
     * メール認証トークンを生成して認証メールを送信
     *
     * <p>Issue#113: テンプレートと言語判定を {@link EmailTemplateService} に一元化。
     * グループ A (HTTP 失敗扱い) のため、メール送信失敗時は例外を呼び出し元へ伝播し、
     * Controller 層で {@code 500 Internal Server Error} にマップされる。</p>
     */
    private void sendVerificationEmail(User user) {
        emailVerificationTokenRepository.findByUserId(user.getId()).ifPresent(
            token -> emailVerificationTokenRepository.delete(token)
        );

        String token = TokenGenerator.generateSecureToken();
        Date expiryDate = new Date(System.currentTimeMillis()
                + EMAIL_VERIFICATION_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

        EmailVerificationToken verificationToken = new EmailVerificationToken(
                user.getId(), token, expiryDate);
        emailVerificationTokenRepository.save(verificationToken);

        String link = frontendUrl + "/verify-email?token=" + token;
        String subject = emailTemplateService.subject("email.verification", user);
        String body = emailTemplateService.body("email.verification", user, user.getUsername(), link);
        emailService.send(user.getEmail(), subject, body);
    }

}
