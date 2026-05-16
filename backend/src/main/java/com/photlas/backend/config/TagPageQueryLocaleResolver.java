package com.photlas.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.LocaleResolver;

import java.util.Locale;
import java.util.Set;

/**
 * Issue#136 Phase 1: ?lang=xx クエリパラメータを Spring の {@link Locale} に変換する
 * カスタム request-scoped resolver。
 *
 * <p>Spring の慣習: Bean 名 "localeResolver" にすることで DispatcherServlet が
 * 自動的にデフォルト resolver を置き換える。Bean 名指定無しだとクラス名から
 * "tagPageQueryLocaleResolver" になり、デフォルトの {@code AcceptHeaderLocaleResolver}
 * が使われてしまうので注意。</p>
 *
 * <p>Photlas は JWT ステートレスで HTTP セッションを持たないため、
 * {@code SessionLocaleResolver} / {@code CookieLocaleResolver} の組み合わせは適合しない。
 * リクエストごとに ?lang を読み取り Locale を返す純粋関数的な実装にしている。</p>
 *
 * <p>Q20: 非正規・未サポートの lang コードも canonical (en/ja/zh/ko/es) に正規化する。
 * URL レベルの 301 リダイレクトは {@code TagPageController} で別途行う。</p>
 */
@Component("localeResolver")
public class TagPageQueryLocaleResolver implements LocaleResolver {

    /** SSR ランディングがサポートする canonical 言語コード。Issue#135 と完全一致。 */
    static final Set<String> SUPPORTED = Set.of("en", "ja", "zh", "ko", "es");

    /** デフォルト言語。海外ユーザー優先のため英語。 */
    private static final Locale DEFAULT = Locale.ENGLISH;

    @Override
    public Locale resolveLocale(HttpServletRequest request) {
        String lang = request.getParameter("lang");
        String canonical = canonicalize(lang);
        return canonical != null ? Locale.of(canonical) : DEFAULT;
    }

    @Override
    public void setLocale(HttpServletRequest req, HttpServletResponse res, Locale locale) {
        // request-scoped なので「Locale をどこかに保存する」概念は無い。no-op。
    }

    /**
     * 任意の lang コードを 5 言語 SUPPORTED のいずれかに正規化する。
     *
     * <ul>
     *   <li>"ja" / "JA" / "ja-JP" → "ja"</li>
     *   <li>"zh" / "zh-CN" / "zh-TW" / "zh-Hans" / "ZH_tw" → "zh"
     *       （フロントが zh-CN/zh-TW を送ってきても受ける）</li>
     *   <li>"en" / "en-US" → "en"</li>
     *   <li>サポート外（"fr" 等）→ null（呼び出し側が default にフォールバック）</li>
     * </ul>
     */
    public static String canonicalize(String lang) {
        if (lang == null || lang.isBlank()) return null;
        String normalized = lang.toLowerCase().trim();
        if (SUPPORTED.contains(normalized)) return normalized;
        // 言語部分のみ取り出し: "zh-tw" / "zh_cn" → "zh"
        String baseLang = normalized.split("[-_]")[0];
        return SUPPORTED.contains(baseLang) ? baseLang : null;
    }
}
