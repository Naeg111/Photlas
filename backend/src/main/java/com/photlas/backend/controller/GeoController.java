package com.photlas.backend.controller;

import com.photlas.backend.dto.GeoCountryResponse;
import com.photlas.backend.service.GeoIpService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issue#106: IPアドレスからの国判定エンドポイント
 *
 * フロントエンドのマップ初期表示位置の最適化のために使用される。
 * 認証不要（ログイン前でも呼び出し可能）。
 */
@RestController
@RequestMapping("/api/v1/geo")
public class GeoController {

    private static final String X_FORWARDED_FOR = "X-Forwarded-For";

    private final GeoIpService geoIpService;

    public GeoController(GeoIpService geoIpService) {
        this.geoIpService = geoIpService;
    }

    /**
     * リクエスト元のIPアドレスから国コード（ISO 3166-1 alpha-2）を返す。
     * 判定不能の場合は countryCode: null を返す（500エラーにしない）。
     *
     * @param request HTTPリクエスト（IPアドレスの取得に使用）
     * @return 国コードまたは null を含むレスポンス
     */
    @GetMapping("/my-country")
    public GeoCountryResponse getMyCountry(HttpServletRequest request) {
        String ipAddress = resolveClientIp(request);
        String countryCode = geoIpService.getCountryCode(ipAddress);
        return new GeoCountryResponse(countryCode);
    }

    /**
     * クライアントの実IPアドレスを取得する。
     * X-Forwarded-For ヘッダーがあれば最初のIPを使用（リバースプロキシ・ロードバランサー対応）、
     * なければ HttpServletRequest.getRemoteAddr() を使用する。
     */
    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader(X_FORWARDED_FOR);
        if (xff != null && !xff.isBlank()) {
            // カンマ区切りで複数のIPがある場合、最初の1つがクライアントの実IP
            int commaIndex = xff.indexOf(',');
            String firstIp = (commaIndex >= 0) ? xff.substring(0, commaIndex) : xff;
            return firstIp.trim();
        }
        return request.getRemoteAddr();
    }
}
