package com.photlas.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * ユーザーSNSリンクエンティティ
 * ユーザーのプロフィールに表示するSNSリンク（X、Instagram等）を表します。
 */
@Entity
@Table(name = "user_sns_links")
public class UserSnsLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sns_link_id")
    private Long snsLinkId;

    @Column(name = "user_id", nullable = false)
    @NotNull
    private Long userId;

    @Column(nullable = false, length = 2048)
    @NotNull
    @Size(max = 2048)
    private String url;

    public UserSnsLink() {}

    public UserSnsLink(Long userId, String url) {
        this.userId = userId;
        this.url = url;
    }

    // Getters and Setters
    public Long getSnsLinkId() {
        return snsLinkId;
    }

    public void setSnsLinkId(Long snsLinkId) {
        this.snsLinkId = snsLinkId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
