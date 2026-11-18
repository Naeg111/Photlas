package com.photlas.backend.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Spec#169: サーバーが記録した時刻（LocalDateTime）を扱うためのユーティリティ。
 *
 * <p>作成時刻などは {@code LocalDateTime.now()} / {@code @CreationTimestamp} で、JVM の既定の
 * タイムゾーンの時刻として DB（{@code TIMESTAMP}、タイムゾーンなし）に記録されている。本番の JVM は
 * UTC なので、保存されている値は UTC の時刻になる。日本時間とはみなさないこと。</p>
 *
 * <p>撮影日時（{@code shot_at}）はカメラの時計の時刻で、サーバーのタイムゾーンとは関係がないため、
 * このクラスでは扱わない。</p>
 */
public final class ServerTime {

    private ServerTime() {}

    /**
     * サーバーが記録した時刻を、JVM の既定のタイムゾーンの時刻として読み、{@link Instant} に直す。
     *
     * @param serverLocal サーバーが記録した時刻（null 可）
     * @return 対応する瞬間。引数が null なら null
     */
    public static Instant toInstant(LocalDateTime serverLocal) {
        return serverLocal == null ? null : serverLocal.atZone(ZoneId.systemDefault()).toInstant();
    }

    /**
     * サーバーが記録した時刻を、UTC の ISO 8601 文字列（末尾 {@code Z}、例: {@code 2026-11-15T13:40:00Z}）にする。
     * API でブラウザやアプリに返すときに使う（オフセットのない文字列は、受け取った側の現地時刻とみなされるため）。
     *
     * @param serverLocal サーバーが記録した時刻（null 可）
     * @return UTC の ISO 8601 文字列。引数が null なら null
     */
    public static String toUtcIsoString(LocalDateTime serverLocal) {
        Instant instant = toInstant(serverLocal);
        return instant == null ? null : instant.toString();
    }

    /**
     * 瞬間（{@link Instant}）を、保存や比較に使う JVM の既定のタイムゾーンの LocalDateTime にする。
     *
     * @param instant 瞬間（null 可）
     * @return JVM の既定のタイムゾーンの時刻。引数が null なら null
     */
    public static LocalDateTime fromInstant(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
}
