package com.photlas.backend.exception;

import com.photlas.backend.dto.ErrorResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#93: GlobalExceptionHandler がすべてのエラーレスポンスに code を付けることを確かめる。
 * フロントエンドは code から表示言語の文言を出すため、code が無いと日本語の message しか出せない。
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    private static void assertError(ResponseEntity<ErrorResponse> response, HttpStatus status, String code) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo(code);
    }

    @Test
    @DisplayName("Issue#93 - 409 は例外が持つコードをそのまま返す（CONFLICT に丸めない）")
    void conflict_returnsCodeOfException() {
        assertError(handler.handleConflictException(
                        new ConflictException(ErrorCodes.EMAIL_PENDING_DELETION, "退会処理中")),
                HttpStatus.CONFLICT, ErrorCodes.EMAIL_PENDING_DELETION);
        assertError(handler.handleConflictException(
                        new ConflictException(ErrorCodes.ALREADY_REPORTED, "通報済み")),
                HttpStatus.CONFLICT, ErrorCodes.ALREADY_REPORTED);
    }

    @Test
    @DisplayName("Issue#93 - 409 の例外はコード無しでは作れない（code: null のレスポンスを防ぐ）")
    void conflict_requiresCode() {
        assertThatThrownBy(() -> new ConflictException(null, "x"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new ConflictException(null, "x", new RuntimeException()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    @DisplayName("Issue#93 - コード付きの 400 の例外もコード無しでは作れない")
    void codedBadRequestExceptions_requireCode() {
        assertThatThrownBy(() -> new InvalidRequestException(null, "x"))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new InvalidStateException(null, "x"))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    @DisplayName("Issue#93 - 見つからない系の 404 にそれぞれのコードが付く")
    void notFound_returnsSpecificCodes() {
        assertError(handler.handleFavoriteNotFoundException(new FavoriteNotFoundException("x")),
                HttpStatus.NOT_FOUND, ErrorCodes.FAVORITE_NOT_FOUND);
        assertError(handler.handleUserNotFoundException(new UserNotFoundException("x")),
                HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
        assertError(handler.handlePhotoNotFoundException(new PhotoNotFoundException("x")),
                HttpStatus.NOT_FOUND, ErrorCodes.PHOTO_NOT_FOUND);
        assertError(handler.handleSpotNotFoundException(new SpotNotFoundException("x")),
                HttpStatus.NOT_FOUND, ErrorCodes.SPOT_NOT_FOUND);
    }

    @Test
    @DisplayName("Issue#93 - 自分の通報・アクセス拒否にコードが付く")
    void selfReportAndAccessDenied_returnCodes() {
        assertError(handler.handleSelfReportException(new SelfReportException("x")),
                HttpStatus.BAD_REQUEST, ErrorCodes.SELF_REPORT);
        assertError(handler.handleAccessDeniedException(new AccessDeniedException("x")),
                HttpStatus.FORBIDDEN, ErrorCodes.ACCESS_DENIED);
    }

    @Test
    @DisplayName("Issue#93 - IllegalArgumentException はコード付きならそのコードと message を返す")
    void illegalArgument_coded_returnsCodeAndMessage() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgumentException(
                new InvalidRequestException(ErrorCodes.INVALID_TOKEN, "トークンが無効または期限切れです"));
        assertError(response, HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_TOKEN);
        assertThat(response.getBody().getMessage()).isEqualTo("トークンが無効または期限切れです");
    }

    @Test
    @DisplayName("Issue#93 - コードの無い IllegalArgumentException は BAD_REQUEST で、内部の message を返さない")
    void illegalArgument_uncoded_hidesInternalMessage() {
        ResponseEntity<ErrorResponse> response = handler.handleIllegalArgumentException(
                new IllegalArgumentException("不明な OAuthProvider コード: 99"));
        assertError(response, HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST);
        assertThat(response.getBody().getMessage())
                .isEqualTo(GlobalExceptionHandler.BAD_REQUEST_MESSAGE)
                .doesNotContain("OAuthProvider");
    }

    @Test
    @DisplayName("Issue#93 - コード付きの InvalidStateException は 400 とそのコード")
    void invalidState_returnsCode() {
        assertError(handler.handleInvalidStateException(
                        new InvalidStateException(ErrorCodes.SUGGESTION_ALREADY_RESOLVED, "解決済み")),
                HttpStatus.BAD_REQUEST, ErrorCodes.SUGGESTION_ALREADY_RESOLVED);
    }

    @Test
    @DisplayName("Issue#93 - 想定外のエラーは INTERNAL_ERROR")
    void generic_returnsInternalError() {
        assertError(handler.handleGenericException(new RuntimeException("boom")),
                HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_ERROR);
    }

    @Test
    @DisplayName("Issue#93 - 既存のコード（認証・停止・禁止・未認証・エクスポート）は変わらない")
    void existingCodes_unchanged() {
        assertError(handler.handleUnauthorizedException(new UnauthorizedException("x")),
                HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS");
        assertError(handler.handleAccountSuspendedException(new AccountSuspendedException("x")),
                HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        assertError(handler.handleForbiddenException(new ForbiddenException("x")),
                HttpStatus.FORBIDDEN, "FORBIDDEN");
        assertError(handler.handleEmailNotVerifiedException(new EmailNotVerifiedException("x")),
                HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED");
        assertError(handler.handleExportInProgressException(new ExportInProgressException("x")),
                HttpStatus.CONFLICT, "EXPORT_IN_PROGRESS");
        assertError(handler.handleExportRateLimitException(
                        new ExportRateLimitException("x", Duration.ofHours(1))),
                HttpStatus.TOO_MANY_REQUESTS, "EXPORT_RATE_LIMITED");
    }
}
