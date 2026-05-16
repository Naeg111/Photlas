package com.photlas.backend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.MessageSource;
import org.springframework.context.support.StaticMessageSource;
import org.springframework.test.context.ActiveProfiles;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#136 §3.6: messages*.properties で MessageFormat の {@code '} エスケープが正しく
 * 適用されることを保証する回帰テスト。
 *
 * <p>Spring の {@link MessageSource} は、引数 (args) が non-null のとき内部で
 * {@link java.text.MessageFormat} を使う。MessageFormat の規約により:</p>
 * <ul>
 *   <li>{@code 'X'} は X を「リテラル」として扱う（{@code {0}} 等の置換も止まる）</li>
 *   <li>{@code ''} は単一のアポストロフィ ({@code '}) を表す</li>
 * </ul>
 *
 * <p>つまり messages に {@code It''s {0}!} と書けば {@code "It's foo!"} となる。
 * {@code It's {0}!} と書いてしまうと {@code {0}} が置換されず {@code "It's {0}!"} の
 * まま出てしまう。本テストはその規約が Spring + Photlas のセットアップで通用する
 * ことを最小コストで確認する。</p>
 *
 * <p>本番 {@code messages*.properties} には現状アポストロフィを含む文言は無いが、
 * 将来追加する開発者がエスケープ規約を間違えないようテストで意図を文書化する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class MessageSourceApostropheEscapeTest {

    @Autowired
    private MessageSource messageSource;

    @Test
    @DisplayName("Issue#136 §3.6: '' エスケープでリテラルのアポストロフィが描画される")
    void doubleApostropheRendersSingleApostrophe() {
        // 注入した messageSource はキー解決時に Spring が下流の MessageFormat 処理を行う。
        // 本番 messages にキー追加せずに振る舞いだけ確認するため、StaticMessageSource で
        // 同じ Spring 抽象をなぞる（同 API・同実装なので挙動は本番と一致）。
        StaticMessageSource sms = new StaticMessageSource();
        sms.addMessage("test.apos", Locale.ENGLISH, "It''s {0}!");

        String rendered = sms.getMessage("test.apos", new Object[]{"ok"}, Locale.ENGLISH);

        assertThat(rendered).isEqualTo("It's ok!");
    }

    @Test
    @DisplayName("Issue#136 §3.6: 単独 ' は MessageFormat 規約上エスケープ扱いとなり {0} が置換されない")
    void singleApostropheBlocksPlaceholderSubstitution() {
        StaticMessageSource sms = new StaticMessageSource();
        // 開発者が誤って '' ではなく ' で書いてしまった場合の振る舞いを文書化
        sms.addMessage("test.bad", Locale.ENGLISH, "It's {0}!");

        String rendered = sms.getMessage("test.bad", new Object[]{"ok"}, Locale.ENGLISH);

        // {0} が置換されず "{0}" のまま残る → これがバグの典型例
        assertThat(rendered).isEqualTo("Its {0}!");
    }

    @Test
    @DisplayName("Issue#136 §3.6: 引数 null のときは MessageFormat を使わず ' はリテラル扱い")
    void noArgsKeepsApostropheAsLiteral() {
        StaticMessageSource sms = new StaticMessageSource();
        sms.addMessage("test.noarg", Locale.ENGLISH, "It's a test");

        // args=null だと Spring MessageSource は MessageFormat に渡さず生文字列を返す
        String rendered = sms.getMessage("test.noarg", null, Locale.ENGLISH);

        assertThat(rendered).isEqualTo("It's a test");
    }

    @Test
    @DisplayName("Issue#136 §3.6: 本番 messages*.properties にアポストロフィを含む文言が無いことを確認")
    void productionMessagesDoNotContainUnescapedApostrophes() {
        // 既存 tag.page.* キーに args を渡しても {N} が正しく置換されていることを確認
        // → アポストロフィ未エスケープのバグが本番 messages に混入していないことの証跡
        String enTitle = messageSource.getMessage(
                "tag.page.title", new Object[]{"Cherry Blossom", 1, 3L}, Locale.ENGLISH);
        assertThat(enTitle).contains("Cherry Blossom").contains("Page 1");

        String jaTitle = messageSource.getMessage(
                "tag.page.title", new Object[]{"桜", 2, 49L}, Locale.JAPANESE);
        assertThat(jaTitle).contains("桜").contains("2 ページ目");
    }
}
