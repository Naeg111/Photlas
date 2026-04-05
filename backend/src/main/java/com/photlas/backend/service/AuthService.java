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

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            EmailVerificationTokenRepository emailVerificationTokenRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
    }

    /**
     * ユーザー登録処理
     * メール認証トークンを生成し、認証メールを送信する。
     *
     * @param request 登録リクエスト
     * @return 登録レスポンス
     */
    @Transactional
    public RegisterResponse registerUser(RegisterRequest request) {
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

        user = userRepository.save(user);

        sendVerificationEmail(user);

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            null
        );
    }

    /**
     * ログイン処理
     *
     * @param request ログインリクエスト
     * @return ログインレスポンス
     */
    public RegisterResponse loginUser(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByEmail(request.getEmail().toLowerCase());

        if (userOptional.isEmpty()) {
            throw new UnauthorizedException("メールアドレスまたはパスワードが正しくありません");
        }

        User user = userOptional.get();

        // 退会チェックをパスワード検証の前に実行（レスポンスの違いで退会状態を推測させない）
        if (user.getDeletedAt() != null) {
            throw new UnauthorizedException("メールアドレスまたはパスワードが正しくありません");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("メールアドレスまたはパスワードが正しくありません");
        }

        if (!user.isEmailVerified()) {
            throw new EmailNotVerifiedException("メールアドレスが認証されていません。認証メール内のリンクをクリックしてください。");
        }

        if (Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(user.getRole())) {
            throw new AccountSuspendedException("アカウントが停止されています");
        }

        String token = jwtService.generateTokenWithRole(user.getEmail(), CodeConstants.roleToJwtString(user.getRole()));

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
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
     * メール認証トークンを生成して認証メールを送信
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

        emailService.send(
                user.getEmail(),
                "【Photlas】メールアドレスの確認",
                user.getUsername() + " さん\n\n" +
                "Photlasへのご登録ありがとうございます！\n" +
                "以下のリンクをクリックして、メールアドレスを確認してください：\n\n" +
                frontendUrl + "/verify-email?token=" + token + "\n\n" +
                "このリンクの有効期限は24時間です。\n\n" +
                "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                "Photlas チーム");
    }
}
