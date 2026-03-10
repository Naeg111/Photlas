package com.photlas.backend.entity;

/**
 * コンテンツモデレーションステータス
 * 投稿画像およびプロフィール画像の審査状態を表します。
 */
public enum ModerationStatus {

    /** 審査待ち。AIスキャン結果を待っている状態 */
    PENDING_REVIEW,

    /** 公開中。問題なしと判断された状態 */
    PUBLISHED,

    /** 隔離中。AI検知またはユーザー通報により管理者の審査待ち */
    QUARANTINED,

    /** 違反確定。管理者が「違反あり」と判定した状態 */
    REMOVED
}
