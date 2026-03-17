package com.photlas.backend.entity;

/**
 * Issue#65: 位置情報修正の指摘ステータス
 */
public enum LocationSuggestionStatus {

    /** 未解決。投稿者の判断待ち */
    PENDING,

    /** 受け入れ済み。投稿者が指摘を受け入れた */
    ACCEPTED,

    /** 拒否済み。投稿者が指摘を拒否した */
    REJECTED
}
