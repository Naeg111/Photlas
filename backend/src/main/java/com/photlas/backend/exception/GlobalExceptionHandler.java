package com.photlas.backend.exception;

import com.photlas.backend.dto.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.ArrayList;
import java.util.List;

/**
 * グローバル例外ハンドラー
 * アプリケーション全体の例外を一元的に処理します。
 * ResponseEntityExceptionHandlerを継承してSpring MVC標準例外を適切に処理します。
 * Spec#19, Spec#20
 *
 * <p>Spec#93: すべてのエラーレスポンスに {@code code}（{@link ErrorCodes}）を付ける。
 * フロントエンドはこのコードから表示言語の文言を出し、{@code message} は画面に出さない。
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Spec#93: コードの無い 400 で返す固定の message（内部の message は返さない） */
    static final String BAD_REQUEST_MESSAGE = "リクエストが正しくありません";

    /** Spec#93: 想定外のエラー（500）で返す固定の message */
    static final String INTERNAL_ERROR_MESSAGE = "サーバーエラーが発生しました";

    /**
     * バリデーションエラーをハンドリング
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<ErrorResponse.FieldError> errors = new ArrayList<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.add(new ErrorResponse.FieldError(
                    fieldError.getField(),
                    fieldError.getRejectedValue(),
                    fieldError.getDefaultMessage()
            ));
        }

        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.VALIDATION_ERROR, "入力内容が無効です。");
        errorResponse.setErrors(errors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Spec#93: Spring MVC 標準の例外（壊れた JSON、必須パラメーターの欠落、型の不一致、405、415 など）にも
     * code を付ける。既定の本文（ProblemDetail）の代わりに、4xx は {@code BAD_REQUEST}、5xx は
     * {@code INTERNAL_ERROR} と固定の文言を返す（フロントは画面ごとの汎用の文言で表示する）。
     * 入力チェックエラーは {@link #handleMethodArgumentNotValid} が {@code VALIDATION_ERROR} で返す。
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, statusCode, request);
        if (response == null) {
            // レスポンスが既に送信済みなどで、本文を書けない場合
            return null;
        }
        ErrorResponse errorResponse;
        if (statusCode.is5xxServerError()) {
            logger.error("Spring MVC の処理でエラーが発生しました", ex);
            errorResponse = new ErrorResponse(ErrorCodes.INTERNAL_ERROR, INTERNAL_ERROR_MESSAGE);
        } else {
            errorResponse = new ErrorResponse(ErrorCodes.BAD_REQUEST, BAD_REQUEST_MESSAGE);
        }
        return ResponseEntity.status(response.getStatusCode()).headers(response.getHeaders()).body(errorResponse);
    }

    /**
     * Spec#20: 認証エラー（401 Unauthorized）をハンドリング
     *
     * <p>Spec#93 注意: {@link UnauthorizedException} は「メールアドレスかパスワードが違う」のほか、
     * 「ユーザーが見つからない」「現在のパスワードが違う」などにも使われており、すべて
     * {@code INVALID_CREDENTIALS} になる。今のフロントで 401 の code から文言を出すのはログイン画面だけ。
     * ほかの画面で 401 の code を使うときは、場面ごとにコードを分けること。
     */
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorizedException(UnauthorizedException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.INVALID_CREDENTIALS, ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
    }

    /**
     * Spec#19, Spec#20: 競合エラー（409 Conflict）をハンドリング
     */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflictException(ConflictException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ex.getCode(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
    }

    /**
     * Spec#30: お気に入りが見つからない（404 Not Found）をハンドリング
     */
    @ExceptionHandler(FavoriteNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleFavoriteNotFoundException(FavoriteNotFoundException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.FAVORITE_NOT_FOUND, ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * ユーザーが見つからない（404 Not Found）をハンドリング
     */
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleUserNotFoundException(UserNotFoundException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.USER_NOT_FOUND, ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * 写真が見つからない（404 Not Found）をハンドリング
     */
    @ExceptionHandler(PhotoNotFoundException.class)
    public ResponseEntity<ErrorResponse> handlePhotoNotFoundException(PhotoNotFoundException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.PHOTO_NOT_FOUND, ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * スポットが見つからない（404 Not Found）をハンドリング
     */
    @ExceptionHandler(SpotNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleSpotNotFoundException(SpotNotFoundException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.SPOT_NOT_FOUND, ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
    }

    /**
     * Spec#54: 自分のコンテンツ通報エラー（400 Bad Request）をハンドリング
     */
    @ExceptionHandler(SelfReportException.class)
    public ResponseEntity<ErrorResponse> handleSelfReportException(SelfReportException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.SELF_REPORT, ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Spec#54: アカウント停止エラー（403 Forbidden）をハンドリング
     */
    @ExceptionHandler(AccountSuspendedException.class)
    public ResponseEntity<ErrorResponse> handleAccountSuspendedException(AccountSuspendedException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.ACCOUNT_SUSPENDED, ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    /**
     * Spec#104: 操作禁止エラー（403 Forbidden）をハンドリング
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbiddenException(ForbiddenException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.FORBIDDEN, ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    /**
     * Spec#54: アクセス拒否エラー（403 Forbidden）をハンドリング
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(
            org.springframework.security.access.AccessDeniedException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.ACCESS_DENIED, "アクセスが拒否されました");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    /**
     * メール未認証エラー（403 Forbidden）をハンドリング
     */
    @ExceptionHandler(EmailNotVerifiedException.class)
    public ResponseEntity<ErrorResponse> handleEmailNotVerifiedException(EmailNotVerifiedException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.EMAIL_NOT_VERIFIED, ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(errorResponse);
    }

    /**
     * Spec#93: コード付きの不正な入力（400 Bad Request）をハンドリング
     * そのコードと固定の message を返す。
     */
    @ExceptionHandler(InvalidRequestException.class)
    public ResponseEntity<ErrorResponse> handleInvalidRequestException(InvalidRequestException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ex.getCode(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Spec#93: カテゴリが見つからない（400 Bad Request）をハンドリング
     * 写真の投稿・編集で、存在しないカテゴリを指定したとき。
     */
    @ExceptionHandler(CategoryNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCategoryNotFoundException(CategoryNotFoundException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.CATEGORY_NOT_FOUND, ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * コードの無い不正な引数エラー（400 Bad Request）をハンドリング
     *
     * <p>Spec#93: コードの無い例外の message はライブラリ等の内部向けのことがあるため返さず、
     * 固定の文言にしてログにだけ残す。コード付きの {@link InvalidRequestException} は上のハンドラーが扱う。
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        logger.warn("コードの無い不正な引数エラー: {}", ex.getMessage());
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.BAD_REQUEST, BAD_REQUEST_MESSAGE);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Spec#93: 今の状態ではできない操作（400 Bad Request）をハンドリング
     *
     * <p>コード付きの {@link InvalidStateException} だけを 400 にする。
     * コードの無い {@link IllegalStateException} は想定外のエラーとして 500 のまま扱う。
     */
    @ExceptionHandler(InvalidStateException.class)
    public ResponseEntity<ErrorResponse> handleInvalidStateException(InvalidStateException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ex.getCode(), ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Spec#108: データエクスポート同時実行（409 Conflict）をハンドリング
     */
    @ExceptionHandler(ExportInProgressException.class)
    public ResponseEntity<ErrorResponse> handleExportInProgressException(ExportInProgressException ex) {
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.EXPORT_IN_PROGRESS, ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
    }

    /**
     * Spec#108: データエクスポート頻度制限（429 Too Many Requests + Retry-After）をハンドリング
     */
    @ExceptionHandler(ExportRateLimitException.class)
    public ResponseEntity<ErrorResponse> handleExportRateLimitException(ExportRateLimitException ex) {
        long seconds = Math.max(1, ex.getRetryAfter().toSeconds());
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.EXPORT_RATE_LIMITED, ex.getMessage());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(seconds))
                .body(errorResponse);
    }

    /**
     * 未ハンドル例外のcatch-all（スタックトレース漏洩防止）
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex) {
        logger.error("予期しないエラーが発生しました", ex);
        ErrorResponse errorResponse = new ErrorResponse(ErrorCodes.INTERNAL_ERROR, INTERNAL_ERROR_MESSAGE);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }
}
