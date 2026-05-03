package com.photlas.backend.service;

import com.photlas.backend.entity.User;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.stereotype.Service;

import java.util.Locale;

/**
 * Issue#113: トランザクションメールの 5 言語対応共通基盤。
 *
 * <p>Spring {@link MessageSource} (Bean 名 `emailMessageSource`) をラップし、
 * テンプレートキーと言語コードから件名・本文を生成する。</p>
 *
 * <p>{@code body()} は末尾に {@code email.signature} キーを自動付与する
 * （DRY のため、各テンプレートに署名プレースホルダを書かなくて良い）。</p>
 *
 * <p>言語フォールバック: BCP-47 タグ ("zh-CN" 等) は {@link Locale} に変換し、
 * Spring の標準フォールバックに委ねる ("messages_zh_CN" → "messages_zh" →
 * "messages_en" の順)。null・空文字は en にフォールバックする。</p>
 */
@Service
public class EmailTemplateService {

    private static final String SIGNATURE_KEY = "email.signature";

    private final MessageSource emailMessageSource;

    public EmailTemplateService(@Qualifier("emailMessageSource") MessageSource emailMessageSource) {
        this.emailMessageSource = emailMessageSource;
    }

    /**
     * 件名を取得する。
     *
     * @param key      テンプレートキーのプレフィックス（例: "email.verification"）
     * @param language ユーザー言語コード（"ja" / "en" / "ko" / "zh-CN" / "zh-TW" / null）
     * @param args     プレースホルダ引数（{0}, {1} ... に対応）
     * @return ローカライズされた件名
     */
    public String subject(String key, String language, Object... args) {
        return resolve(key + ".subject", language, args);
    }

    /**
     * User オブジェクトから言語を取得する件名取得オーバーロード。
     */
    public String subject(String key, User user, Object... args) {
        return subject(key, user == null ? null : user.getLanguage(), args);
    }

    /**
     * 本文を取得する。末尾に共通シグネチャ（{@value #SIGNATURE_KEY}）を自動付与する。
     *
     * @param key      テンプレートキーのプレフィックス（例: "email.verification"）
     * @param language ユーザー言語コード
     * @param args     プレースホルダ引数
     * @return ローカライズされた本文 + "\n\n" + 共通シグネチャ
     */
    public String body(String key, String language, Object... args) {
        String content = resolve(key + ".body", language, args);
        String signature = signature(language);
        return content + "\n\n" + signature;
    }

    /**
     * User オブジェクトから言語を取得する本文取得オーバーロード。
     */
    public String body(String key, User user, Object... args) {
        return body(key, user == null ? null : user.getLanguage(), args);
    }

    /**
     * 共通シグネチャ（メール本文末尾の Photlas 署名）を取得する。
     *
     * @param language ユーザー言語コード
     * @return ローカライズされたシグネチャ
     */
    public String signature(String language) {
        return resolve(SIGNATURE_KEY, language);
    }

    private String resolve(String key, String language, Object... args) {
        Locale locale = toLocale(language);
        try {
            return emailMessageSource.getMessage(key, args, locale);
        } catch (NoSuchMessageException e) {
            throw new IllegalStateException(
                    "メールテンプレートが見つかりません: key=" + key + ", language=" + language, e);
        }
    }

    /**
     * Photlas の言語コード ("ja", "zh-CN" 等) を Java {@link Locale} に変換する。
     * Spring MessageSource の組み込みフォールバック (locale 階層 → defaultLocale) に
     * 依存できるよう {@code Locale("zh", "CN")} 形式で返す。null・空文字は en にフォールバック。
     */
    static Locale toLocale(String language) {
        if (language == null || language.isBlank()) {
            return Locale.ENGLISH;
        }
        String trimmed = language.trim();
        // BCP-47 形式 ("zh-CN") も Java Locale 形式 ("zh_CN") も両方サポート
        String[] parts = trimmed.split("[-_]");
        if (parts.length >= 2) {
            return new Locale(parts[0].toLowerCase(), parts[1].toUpperCase());
        }
        return new Locale(trimmed.toLowerCase());
    }
}
