package com.photlas.backend.repository;

import com.photlas.backend.entity.UserSnsLink;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * ユーザーSNSリンクリポジトリ
 * ユーザーのSNSリンク情報のデータアクセスを提供します。
 */
@Repository
public interface UserSnsLinkRepository extends JpaRepository<UserSnsLink, Long> {

    /**
     * ユーザーIDでSNSリンクを検索
     *
     * @param userId ユーザーID
     * @return SNSリンクのリスト
     */
    List<UserSnsLink> findByUserId(Long userId);

    /**
     * ユーザーIDでSNSリンクを削除
     *
     * @param userId ユーザーID
     */
    void deleteByUserId(Long userId);

    /**
     * Issue#108: 指定ユーザーの SNS リンクを ID 降順で取得する。
     * UserSnsLink には createdAt カラムが無いため snsLinkId を作成順の代理キーとして使用する。
     */
    List<UserSnsLink> findByUserIdOrderBySnsLinkIdDesc(Long userId);
}
