package com.photlas.backend.util;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;

/**
 * ユーザー名の予約語リスト。
 * Issue#98: ユーザー名バリデーション強化。
 *
 * <p>管理者詐称・URL パス衝突・サービス名衝突等を防ぐための予約語をまとめる。
 */
public final class UsernameReservedWords {

    public static final Set<String> RESERVED = Set.of(
            // 管理者詐称
            "admin", "administrator", "root", "system", "sysadmin",
            "moderator", "mod", "support", "staff", "official",
            "owner", "superuser",

            // サービス名
            "photlas", "photlas_official", "photlas_support",

            // URL パス（API・認証系）
            "api", "oauth", "oauth2", "login", "logout", "signup",
            "register", "settings", "profile", "me", "user", "users",
            "account", "accounts", "password", "reset", "verify",
            "auth", "authentication", "callback",

            // URL パス（一般機能・ナビゲーション）
            "home", "about", "help", "terms", "privacy", "contact",
            "search", "feed", "explore", "discover",
            "notifications", "messages", "bookmarks", "likes",
            "following", "followers",

            // URL パス（静的・メディア）
            "static", "assets", "public", "cdn", "media",
            "photos", "images",

            // メール・サブドメイン系
            "www", "mail", "email", "webmaster", "noreply", "no-reply",

            // その他
            "null", "undefined", "none", "anonymous", "guest",
            "test", "temp", "temporary"
    );

    private UsernameReservedWords() {
        // ユーティリティクラスのためインスタンス化を禁止
    }

    /**
     * 予約語かどうかを判定する。
     *
     * <p><strong>大文字小文字無視 + NFKC 正規化後の比較</strong> を行う。
     * 「Admin」のような大文字を使った詐称を弾くため。
     *
     * <p><strong>NFKC 正規化の実態（要注意）:</strong>
     * 本メソッドが呼ばれる時点で、入力は {@link UsernameValidator#validate} の
     * priority 5（FULLWIDTH）/ priority 6（HALFWIDTH_KATAKANA）/ priority 8（OTHER）を
     * すべて通過しているため、ASCII alphanumeric / `_` / `-` / 日本語（ひらがな・全角カタカナ・基本漢字）
     * しか到達しない。これらに対して NFKC 正規化は <strong>常に identity（変化なし）</strong>。
     * <p>
     * つまり <strong>NFKC は機能的には no-op</strong> である。それでもコードに残しているのは、
     * 将来 priority 1-8 の検査に漏れが生じた場合の二重防御のため。コストはごく軽微（µ秒オーダー）。
     * 削除して {@code username.toLowerCase(Locale.ROOT)} だけにしても現状の挙動は変わらない。
     *
     * <p><strong>注意:</strong> 通常のユーザー名同士の衝突判定は <strong>大文字小文字を区別する</strong>
     * （{@code Tanaka} と {@code tanaka} は別ユーザーとして許容）。
     * 予約語チェックの大文字小文字無視ポリシーとは挙動が異なるので留意すること。
     */
    public static boolean isReserved(String username) {
        // NFKC は priority 5/6/8 通過後の入力に対しては実質 no-op（上記 Javadoc 参照）
        String normalized = Normalizer.normalize(username, Normalizer.Form.NFKC);
        return RESERVED.contains(normalized.toLowerCase(Locale.ROOT));
    }
}
