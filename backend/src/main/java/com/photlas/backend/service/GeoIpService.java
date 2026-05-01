package com.photlas.backend.service;

import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.geoip2.exception.AddressNotFoundException;
import com.maxmind.geoip2.exception.GeoIp2Exception;
import com.maxmind.geoip2.model.CountryResponse;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;

/**
 * Issue#106: IPアドレスからの国判定サービス
 *
 * MaxMind GeoLite2-Country データベースを使用してIPアドレスから国コード（ISO 3166-1 alpha-2）を判定する。
 *
 * - データベースファイル（GeoLite2-Country.mmdb）が見つからない場合、サービスは「無効化された状態」で起動し、
 *   getCountryCode は常に null を返す。アプリケーションは引き続き動作可能。
 * - 開発環境（DBファイルなし）でもアプリが起動でき、フロントエンドは東京へのフォールバックで動作する。
 */
@Service
public class GeoIpService {

    private static final Logger log = LoggerFactory.getLogger(GeoIpService.class);

    private final DatabaseReader databaseReader;

    /**
     * 本番用コンストラクタ：classpath からデータベースファイルをロードする。
     * ファイルが見つからない場合は警告ログを出してサービスを無効化された状態で起動する。
     * 複数コンストラクタがあるため @Autowired で Spring に明示。
     */
    @Autowired
    public GeoIpService(@Value("${geoip.database-path:classpath:geoip/GeoLite2-Country.mmdb}") String databasePath) {
        this.databaseReader = loadDatabase(databasePath);
    }

    /**
     * テスト用コンストラクタ：DatabaseReader を直接注入する。
     * null を渡すと「DBが見つからなかった」状態をシミュレートできる。
     */
    GeoIpService(DatabaseReader databaseReader) {
        this.databaseReader = databaseReader;
    }

    private static DatabaseReader loadDatabase(String databasePath) {
        ResourceLoader resourceLoader = new DefaultResourceLoader();
        Resource resource = resourceLoader.getResource(databasePath);
        if (!resource.exists()) {
            log.warn("GeoLite2 database file not found at {}. IP-based country detection will be disabled.", databasePath);
            return null;
        }
        try (InputStream is = resource.getInputStream()) {
            DatabaseReader reader = new DatabaseReader.Builder(is).build();
            log.info("GeoLite2 database loaded successfully from {}", databasePath);
            return reader;
        } catch (IOException e) {
            log.error("Failed to load GeoLite2 database from {}", databasePath, e);
            return null;
        }
    }

    /**
     * IPアドレスから国コード（ISO 3166-1 alpha-2、例: "JP", "US"）を取得する。
     *
     * @param ipAddress IPv4 または IPv6 アドレス
     * @return 国コード。判定不能（IPが不正・ローカルホスト・データベース未配置等）の場合は null
     */
    public String getCountryCode(String ipAddress) {
        if (databaseReader == null || ipAddress == null || ipAddress.isBlank()) {
            return null;
        }
        try {
            InetAddress address = InetAddress.getByName(ipAddress);
            CountryResponse response = databaseReader.country(address);
            if (response == null || response.getCountry() == null) {
                return null;
            }
            return response.getCountry().getIsoCode();
        } catch (AddressNotFoundException e) {
            // IPが GeoLite2 データベースに登録されていない（ローカルホスト等）
            return null;
        } catch (IOException | GeoIp2Exception | RuntimeException e) {
            // 不正なIPアドレス形式・I/O エラー等
            return null;
        }
    }

    @PreDestroy
    public void close() {
        if (databaseReader != null) {
            try {
                databaseReader.close();
            } catch (IOException e) {
                log.warn("Failed to close GeoLite2 database reader", e);
            }
        }
    }
}
