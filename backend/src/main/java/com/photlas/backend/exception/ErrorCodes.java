package com.photlas.backend.exception;

/**
 * Issue#93: API エラーレスポンスの {@code code} に入れるエラーコード。
 *
 * <p>バックエンドはエラーコードを返し、フロントエンドが {@code errors.<code>} の翻訳キーで
 * 表示言語に合わせた文言を出す（Spec#93 2.3 方式 B）。{@code message} はログ・互換のために
 * 日本語のまま残すが、画面には出さない。
 *
 * <p>コードは英大文字とアンダースコアだけ（{@code [A-Z][A-Z_]*}）にする。フロントは {@code errors.<code>} を
 * i18next のキーにするため、{@code .} や {@code :} を含むとキーの区切りと解釈されてしまう。
 * 定数名と値は同じにする（{@code ErrorCodesTranslationTest} で確かめている）。
 */
public final class ErrorCodes {

    private ErrorCodes() {
    }

    // ---- 汎用（フロントは画面ごとの汎用文言で表示する） ----
    /** 入力チェックエラー（詳細は errors[] のフィールド別メッセージ） */
    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    /** 個別のコードを持たない 400 */
    public static final String BAD_REQUEST = "BAD_REQUEST";
    /** 想定外のサーバーエラー */
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    // ---- 401 / 403 ----
    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED";
    public static final String FORBIDDEN = "FORBIDDEN";
    public static final String ACCESS_DENIED = "ACCESS_DENIED";
    public static final String EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED";

    // ---- 404 ----
    public static final String USER_NOT_FOUND = "USER_NOT_FOUND";
    public static final String PHOTO_NOT_FOUND = "PHOTO_NOT_FOUND";
    public static final String SPOT_NOT_FOUND = "SPOT_NOT_FOUND";
    public static final String FAVORITE_NOT_FOUND = "FAVORITE_NOT_FOUND";
    public static final String CATEGORY_NOT_FOUND = "CATEGORY_NOT_FOUND";

    // ---- 409 ----
    public static final String EMAIL_ALREADY_IN_USE = "EMAIL_ALREADY_IN_USE";
    public static final String EMAIL_PENDING_DELETION = "EMAIL_PENDING_DELETION";
    public static final String ALREADY_REPORTED = "ALREADY_REPORTED";
    public static final String ALREADY_FAVORITED = "ALREADY_FAVORITED";
    public static final String PASSWORD_ALREADY_SET = "PASSWORD_ALREADY_SET";
    public static final String EXPORT_IN_PROGRESS = "EXPORT_IN_PROGRESS";

    // ---- 429 ----
    public static final String EXPORT_RATE_LIMITED = "EXPORT_RATE_LIMITED";

    // ---- 400（個別） ----
    public static final String EMAIL_REQUIRED = "EMAIL_REQUIRED";
    public static final String SELF_REPORT = "SELF_REPORT";
    /** メール認証・パスワード再設定・メール変更確定・連携確認・撮影場所レビューのトークンが無効または期限切れ */
    public static final String INVALID_TOKEN = "INVALID_TOKEN";
    /** 連携確認のトークンが使用済み */
    public static final String TOKEN_ALREADY_USED = "TOKEN_ALREADY_USED";
    /** トークン処理中に対象の利用者が退会済みだった */
    public static final String ACCOUNT_DELETED = "ACCOUNT_DELETED";
    public static final String EMAIL_ALREADY_VERIFIED = "EMAIL_ALREADY_VERIFIED";
    public static final String SAME_EMAIL = "SAME_EMAIL";
    public static final String UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE";

    // ---- 撮影場所の指摘（400） ----
    public static final String SUGGESTION_DAILY_LIMIT = "SUGGESTION_DAILY_LIMIT";
    public static final String SUGGESTION_PHOTO_NOT_PUBLIC = "SUGGESTION_PHOTO_NOT_PUBLIC";
    public static final String SUGGESTION_OWN_PHOTO = "SUGGESTION_OWN_PHOTO";
    public static final String SUGGESTION_ALREADY_SENT = "SUGGESTION_ALREADY_SENT";
    public static final String SUGGESTION_TOO_CLOSE = "SUGGESTION_TOO_CLOSE";
    public static final String SUGGESTION_TOO_FAR = "SUGGESTION_TOO_FAR";
    public static final String SUGGESTION_ALREADY_RESOLVED = "SUGGESTION_ALREADY_RESOLVED";
    public static final String PHOTO_UNDER_REVIEW = "PHOTO_UNDER_REVIEW";
    public static final String PHOTO_DELETED = "PHOTO_DELETED";
}
