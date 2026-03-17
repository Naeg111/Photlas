package com.photlas.backend.service;

import com.photlas.backend.entity.LocationSuggestion;
import com.photlas.backend.repository.LocationSuggestionRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Issue#65: 位置情報修正の指摘サービス
 */
@Service
public class LocationSuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(LocationSuggestionService.class);

    private final LocationSuggestionRepository locationSuggestionRepository;
    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    public LocationSuggestionService(
            LocationSuggestionRepository locationSuggestionRepository,
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            UserRepository userRepository,
            JavaMailSender mailSender) {
        this.locationSuggestionRepository = locationSuggestionRepository;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
    }

    /**
     * 位置情報の指摘を作成する
     */
    public LocationSuggestion createSuggestion(Long photoId, String suggesterEmail,
                                                BigDecimal latitude, BigDecimal longitude) {
        // TODO: Green段階で実装
        throw new UnsupportedOperationException("未実装");
    }

    /**
     * 指摘を受け入れる
     */
    public void acceptSuggestion(String reviewToken, String ownerEmail) {
        // TODO: Green段階で実装
        throw new UnsupportedOperationException("未実装");
    }

    /**
     * 指摘を拒否する
     */
    public void rejectSuggestion(String reviewToken, String ownerEmail) {
        // TODO: Green段階で実装
        throw new UnsupportedOperationException("未実装");
    }

    /**
     * レビュー情報を取得する
     */
    public LocationSuggestion getReviewInfo(String reviewToken, String ownerEmail) {
        // TODO: Green段階で実装
        throw new UnsupportedOperationException("未実装");
    }

    /**
     * ユーザーが指定の写真に対して指摘済みかどうかを返す
     */
    public boolean hasSuggested(Long photoId, String userEmail) {
        // TODO: Green段階で実装
        throw new UnsupportedOperationException("未実装");
    }
}
