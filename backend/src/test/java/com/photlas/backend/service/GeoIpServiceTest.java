package com.photlas.backend.service;

import com.maxmind.geoip2.DatabaseReader;
import com.maxmind.geoip2.exception.AddressNotFoundException;
import com.maxmind.geoip2.exception.GeoIp2Exception;
import com.maxmind.geoip2.model.CountryResponse;
import com.maxmind.geoip2.record.Country;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.net.InetAddress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Issue#106: IPアドレスからの国判定サービスのテスト
 */
@ExtendWith(MockitoExtension.class)
public class GeoIpServiceTest {

    @Mock
    private DatabaseReader databaseReader;

    @Test
    @DisplayName("Issue#106 - 有効なIPアドレスから国コード（ISO 3166-1 alpha-2）が返される")
    void getCountryCode_validIp_returnsCountryCode() throws IOException, GeoIp2Exception {
        // Given: モックされた DatabaseReader が日本の CountryResponse を返す
        // CountryResponse / Country のコンストラクタは GeoIP2 4.x で複雑なため、Mockito の deep stubbing でモック
        CountryResponse response = mock(CountryResponse.class);
        Country country = mock(Country.class);
        when(response.getCountry()).thenReturn(country);
        when(country.getIsoCode()).thenReturn("JP");
        when(databaseReader.country(any(InetAddress.class))).thenReturn(response);

        GeoIpService service = new GeoIpService(databaseReader);

        // When: 有効なIPアドレスで国コードを取得
        String result = service.getCountryCode("8.8.8.8");

        // Then: ISO 3166-1 alpha-2 の国コードが返される
        assertThat(result).isEqualTo("JP");
    }

    @Test
    @DisplayName("Issue#106 - DatabaseReader が AddressNotFoundException を投げた場合に null を返す")
    void getCountryCode_addressNotFound_returnsNull() throws IOException, GeoIp2Exception {
        // Given: AddressNotFoundException を投げるモック（ローカルホスト等の判定不能IP相当）
        when(databaseReader.country(any(InetAddress.class)))
                .thenThrow(new AddressNotFoundException("Address not found"));

        GeoIpService service = new GeoIpService(databaseReader);

        // When: ローカルホストIPで国コードを取得
        String result = service.getCountryCode("127.0.0.1");

        // Then: null が返される（例外は伝播しない）
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("Issue#106 - 不正なIPアドレス形式で例外が発生せず null が返される")
    void getCountryCode_invalidIp_returnsNull() {
        GeoIpService service = new GeoIpService(databaseReader);

        // When: 不正なIPアドレス形式
        String result = service.getCountryCode("not-an-ip-address");

        // Then: null が返される（例外は伝播しない）
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("Issue#106 - null IPアドレスで null が返される")
    void getCountryCode_nullIp_returnsNull() {
        GeoIpService service = new GeoIpService(databaseReader);

        // When: null を渡す
        String result = service.getCountryCode(null);

        // Then: null が返される
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("Issue#106 - DatabaseReader が null（DB未配置）の場合、すべての呼び出しで null が返される")
    void getCountryCode_noDatabase_returnsNull() {
        // Given: DatabaseReader が null（DBファイル未配置）
        GeoIpService service = new GeoIpService((DatabaseReader) null);

        // When: 任意のIPアドレスで呼び出し
        String result = service.getCountryCode("8.8.8.8");

        // Then: null が返される（DBがなくても例外を投げず動作する）
        assertThat(result).isNull();
    }
}
