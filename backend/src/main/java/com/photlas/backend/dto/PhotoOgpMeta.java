package com.photlas.backend.dto;

/**
 * Issue#58 §6: /photo-viewer/{id} に差し込む写真個別の OGP メタ値。
 *
 * @param title       og:title / twitter:title 用（例: "東京タワー - Photlas"）
 * @param description og:description / twitter:description / meta description 用
 * @param imageUrl    og:image / twitter:image 用（CDN サムネイル URL、絶対）
 * @param pageUrl     og:url 用（{@code {frontendUrl}/photo-viewer/{id}}、絶対）
 */
public record PhotoOgpMeta(
        String title,
        String description,
        String imageUrl,
        String pageUrl
) {
}
