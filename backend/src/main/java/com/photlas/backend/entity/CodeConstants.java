package com.photlas.backend.entity;

/**
 * Issue#87: 桁区切り数値コード定数
 *
 * DBに保存するenum的な値を、桁区切り数値コードで一元管理する。
 * 番号帯によりフィールドを即座に判別可能。
 *
 * 100番台: User.role
 * 200番台: Category.id
 * 300番台: Photo.time_of_day
 * 400番台: Photo.weather
 * 500番台: Photo.device_type
 * 600番台: UserSnsLink.platform
 * 700番台: AccountSanction.sanction_type
 * 800番台: Violation.violation_type / Report.reason
 * 900番台: ModerationDetail.source
 * 1000番台: Photo.moderation_status
 * 1100番台: Report.target_type / Violation.target_type / ModerationDetail.target_type
 * 1200番台: LocationSuggestion.status
 * 1300番台: Violation.action_taken
 */
public final class CodeConstants {

    private CodeConstants() {}

    // ========== 100番台: User.role ==========
    public static final int ROLE_USER = 101;
    public static final int ROLE_ADMIN = 102;
    public static final int ROLE_SUSPENDED = 103;

    // ========== 200番台: Category.id ==========
    public static final int CATEGORY_NATURE = 201;
    public static final int CATEGORY_CITYSCAPE = 202;
    public static final int CATEGORY_ARCHITECTURE = 203;
    public static final int CATEGORY_NIGHT_VIEW = 204;
    public static final int CATEGORY_GOURMET = 205;
    public static final int CATEGORY_PLANTS = 206;
    public static final int CATEGORY_ANIMALS = 207;
    public static final int CATEGORY_WILD_BIRDS = 208;
    public static final int CATEGORY_CARS = 209;
    public static final int CATEGORY_MOTORCYCLES = 210;
    public static final int CATEGORY_RAILWAYS = 211;
    public static final int CATEGORY_AIRCRAFT = 212;
    public static final int CATEGORY_STARRY_SKY = 213;
    public static final int CATEGORY_OTHER = 214;

    // ========== 300番台: Photo.time_of_day ==========
    public static final int TIME_OF_DAY_MORNING = 301;
    public static final int TIME_OF_DAY_DAY = 302;
    public static final int TIME_OF_DAY_EVENING = 303;
    public static final int TIME_OF_DAY_NIGHT = 304;

    // ========== 400番台: Photo.weather ==========
    public static final int WEATHER_SUNNY = 401;
    public static final int WEATHER_CLOUDY = 402;
    public static final int WEATHER_RAIN = 403;
    public static final int WEATHER_SNOW = 404;

    // ========== 500番台: Photo.device_type ==========
    public static final int DEVICE_TYPE_SLR = 501;
    public static final int DEVICE_TYPE_MIRRORLESS = 502;
    public static final int DEVICE_TYPE_COMPACT = 503;
    public static final int DEVICE_TYPE_SMARTPHONE = 504;
    public static final int DEVICE_TYPE_FILM = 505;
    public static final int DEVICE_TYPE_OTHER = 506;

    // ========== 600番台: UserSnsLink.platform ==========
    public static final int PLATFORM_TWITTER = 601;
    public static final int PLATFORM_INSTAGRAM = 602;
    /** Issue#102: ロゴ使用許可未取得のため一時停止中。定数は将来再開時のため残置。 */
    public static final int PLATFORM_YOUTUBE = 603;
    /** Issue#102: ロゴ使用許可未取得のため一時停止中。定数は将来再開時のため残置。 */
    public static final int PLATFORM_TIKTOK = 604;
    /** Issue#102: Threads は 2025-04 に threads.net → threads.com へ正式移行済み。 */
    public static final int PLATFORM_THREADS = 605;

    // ========== 700番台: AccountSanction.sanction_type ==========
    public static final int SANCTION_WARNING = 701;
    public static final int SANCTION_TEMPORARY_SUSPENSION = 702;
    public static final int SANCTION_PERMANENT_SUSPENSION = 703;

    // ========== 800番台: Violation.violation_type / Report.reason ==========
    public static final int REASON_ADULT_CONTENT = 801;
    public static final int REASON_VIOLENCE = 802;
    public static final int REASON_COPYRIGHT_INFRINGEMENT = 803;
    public static final int REASON_PRIVACY_VIOLATION = 804;
    public static final int REASON_SPAM = 805;
    public static final int REASON_OTHER = 806;

    // ========== 900番台: ModerationDetail.source ==========
    public static final int MODERATION_SOURCE_AI_SCAN = 901;

    // ========== 1000番台: Photo.moderation_status ==========
    public static final int MODERATION_STATUS_PENDING_REVIEW = 1001;
    public static final int MODERATION_STATUS_PUBLISHED = 1002;
    public static final int MODERATION_STATUS_QUARANTINED = 1003;
    public static final int MODERATION_STATUS_REMOVED = 1004;

    /** ブロックコンテンツ表示用の画像キー */
    public static final String BLOCKED_CONTENT_IMAGE_KEY = "assets/blocked-content.png";

    /**
     * 写真がブロックコンテンツ（QUARANTINED/REMOVED）かどうかを判定する
     */
    public static boolean isBlockedContent(Integer moderationStatus) {
        return Integer.valueOf(MODERATION_STATUS_QUARANTINED).equals(moderationStatus)
                || Integer.valueOf(MODERATION_STATUS_REMOVED).equals(moderationStatus);
    }

    // ========== 1100番台: Report.target_type / Violation.target_type / ModerationDetail.target_type ==========
    public static final int TARGET_TYPE_PHOTO = 1101;
    public static final int TARGET_TYPE_PROFILE = 1102;

    // ========== 1200番台: LocationSuggestion.status ==========
    public static final int SUGGESTION_STATUS_PENDING = 1201;
    public static final int SUGGESTION_STATUS_ACCEPTED = 1202;
    public static final int SUGGESTION_STATUS_REJECTED = 1203;

    // ========== 1300番台: Violation.action_taken ==========
    public static final int ACTION_TAKEN_REMOVED = 1301;

    // ========== JWT用role文字列変換 ==========

    /** DB数値コード → JWT用文字列 */
    public static String roleToJwtString(int roleCode) {
        return switch (roleCode) {
            case ROLE_USER -> "USER";
            case ROLE_ADMIN -> "ADMIN";
            case ROLE_SUSPENDED -> "SUSPENDED";
            default -> throw new IllegalArgumentException("不明なロールコード: " + roleCode);
        };
    }

    /** JWT用文字列 → DB数値コード */
    public static int jwtStringToRole(String jwtRole) {
        return switch (jwtRole) {
            case "USER" -> ROLE_USER;
            case "ADMIN" -> ROLE_ADMIN;
            case "SUSPENDED" -> ROLE_SUSPENDED;
            default -> throw new IllegalArgumentException("不明なロール文字列: " + jwtRole);
        };
    }
}
