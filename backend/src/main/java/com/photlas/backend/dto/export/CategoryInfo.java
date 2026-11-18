package com.photlas.backend.dto.export;

/**
 * Spec#108: 写真カテゴリ情報（photos.json の categories 配列要素）。
 */
public record CategoryInfo(Integer id, String name) {}
