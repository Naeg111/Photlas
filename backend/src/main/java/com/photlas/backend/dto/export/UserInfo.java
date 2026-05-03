package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: ユーザー本人のプロフィール情報。user.json に対応する。
 *
 * <p>id、profileImageS3Key 等の内部実装情報は含めない。プロフィール画像本体は
 * 別途 ZIP に同梱される（profile_image.*）。</p>
 *
 * <p>Admin 用エクスポートでは追加で originalUsername / deletedAt / role を別途
 * Controller 側で付与する。</p>
 *
 * @param username             表示名
 * @param email                メールアドレス
 * @param role                 ロール（"USER" / "ADMIN"）
 * @param language             登録言語コード（"ja" / "en" / "ko" / "zh" / "th"）
 * @param createdAt            登録日時（UTC）
 * @param updatedAt            更新日時（UTC）
 * @param termsAgreedAt        利用規約同意日時（未同意なら null）
 * @param privacyPolicyAgreedAt プライバシーポリシー同意日時（未同意なら null）
 * @param originalUsername     退会済みユーザーの元表示名（Admin エクスポート用、それ以外は null）
 * @param deletedAt            退会日時（Admin エクスポート用、それ以外は null）
 */
public record UserInfo(
        String username,
        String email,
        String role,
        String language,
        Instant createdAt,
        Instant updatedAt,
        Instant termsAgreedAt,
        Instant privacyPolicyAgreedAt,
        String originalUsername,
        Instant deletedAt
) {}
