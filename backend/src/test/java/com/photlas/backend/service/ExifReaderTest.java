package com.photlas.backend.service;

import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifSubIFDDirectory;
import com.drew.metadata.exif.GpsDirectory;
import com.drew.lang.Rational;
import com.photlas.backend.dto.ExifData;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#132 - {@link ExifReader} の単体テスト。
 *
 * <p>Metadata からの解析ロジックを直接テストする（package-private な
 * {@code parseMetadata} メソッドを使用）。バイト列入力の happy path は
 * Phase 4 の結合テストでカバーする。</p>
 */
class ExifReaderTest {

    private ExifReader reader;

    @BeforeEach
    void setUp() {
        reader = new ExifReader();
    }

    // ========== 不正バイト列 ==========

    @Test
    @DisplayName("Issue#132 - 空バイト列を読んでも例外を投げず ExifData.empty() を返す")
    void readEmptyBytesReturnsEmpty() {
        ExifData result = reader.read(new byte[0]);

        assertThat(result).isEqualTo(ExifData.empty());
    }

    @Test
    @DisplayName("Issue#132 - 不正バイト列を読んでも例外を投げず ExifData.empty() を返す")
    void readInvalidBytesReturnsEmpty() {
        ExifData result = reader.read(new byte[]{1, 2, 3, 4, 5});

        assertThat(result).isEqualTo(ExifData.empty());
    }

    // ========== Metadata からの解析 (正常系) ==========

    @Test
    @DisplayName("Issue#132 - 全タグ揃った Metadata から ExifData を構築できる")
    void parseMetadataExtractsAllTags() {
        Metadata metadata = new Metadata();
        ExifSubIFDDirectory exif = new ExifSubIFDDirectory();
        exif.setString(ExifSubIFDDirectory.TAG_DATETIME_ORIGINAL, "2026:05:16 22:30:15");
        exif.setObject(ExifSubIFDDirectory.TAG_EXPOSURE_TIME, new Rational(15, 1));
        exif.setInt(ExifSubIFDDirectory.TAG_ISO_EQUIVALENT, 1600);
        exif.setInt(ExifSubIFDDirectory.TAG_35MM_FILM_EQUIV_FOCAL_LENGTH, 50);
        metadata.addDirectory(exif);

        GpsDirectory gps = new GpsDirectory();
        gps.setObject(GpsDirectory.TAG_ALTITUDE, new Rational(1500, 1));
        metadata.addDirectory(gps);

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.dateTimeOriginal())
                .contains(LocalDateTime.of(2026, 5, 16, 22, 30, 15));
        assertThat(data.exposureTimeSeconds()).contains(15.0);
        assertThat(data.iso()).contains(1600);
        assertThat(data.focalLength35mm()).contains(50);
        assertThat(data.gpsAltitude()).contains(1500.0);
    }

    @Test
    @DisplayName("Issue#132 - EXIF Directory が無い Metadata は ExifData.empty() を返す")
    void parseMetadataReturnsEmptyWhenNoExif() {
        Metadata metadata = new Metadata();

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data).isEqualTo(ExifData.empty());
    }

    // ========== Metadata からの解析 (不正値) ==========

    @Test
    @DisplayName("Issue#132 - DateTimeOriginal が \"0000:00:00 00:00:00\" の場合 Optional.empty()")
    void invalidDateTimeOriginalReturnsEmpty() {
        Metadata metadata = metadataWithExifSubIFD(exif -> {
            exif.setString(ExifSubIFDDirectory.TAG_DATETIME_ORIGINAL, "0000:00:00 00:00:00");
        });

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.dateTimeOriginal()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - ExposureTime が 0 以下なら Optional.empty()")
    void exposureTimeZeroReturnsEmpty() {
        Metadata metadata = metadataWithExifSubIFD(exif -> {
            exif.setObject(ExifSubIFDDirectory.TAG_EXPOSURE_TIME, new Rational(0, 1));
        });

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.exposureTimeSeconds()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - ExposureTime が 3600 秒超なら Optional.empty()")
    void exposureTimeAboveLimitReturnsEmpty() {
        Metadata metadata = metadataWithExifSubIFD(exif -> {
            exif.setObject(ExifSubIFDDirectory.TAG_EXPOSURE_TIME, new Rational(3601, 1));
        });

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.exposureTimeSeconds()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - ISO が 0 以下なら Optional.empty()")
    void isoZeroReturnsEmpty() {
        Metadata metadata = metadataWithExifSubIFD(exif -> {
            exif.setInt(ExifSubIFDDirectory.TAG_ISO_EQUIVALENT, 0);
        });

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.iso()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - FocalLengthIn35mmFilm が 0 以下なら Optional.empty()")
    void focalLength35mmZeroReturnsEmpty() {
        Metadata metadata = metadataWithExifSubIFD(exif -> {
            exif.setInt(ExifSubIFDDirectory.TAG_35MM_FILM_EQUIV_FOCAL_LENGTH, 0);
        });

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.focalLength35mm()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - GPSAltitude の絶対値が 10000m 超なら Optional.empty()")
    void gpsAltitudeOutOfRangeReturnsEmpty() {
        Metadata metadata = new Metadata();
        GpsDirectory gps = new GpsDirectory();
        gps.setObject(GpsDirectory.TAG_ALTITUDE, new Rational(15000, 1));
        metadata.addDirectory(gps);

        ExifData data = ExifReader.parseMetadata(metadata);

        assertThat(data.gpsAltitude()).isEmpty();
    }

    // ========== ヘルパー ==========

    private Metadata metadataWithExifSubIFD(java.util.function.Consumer<ExifSubIFDDirectory> setup) {
        Metadata metadata = new Metadata();
        ExifSubIFDDirectory exif = new ExifSubIFDDirectory();
        setup.accept(exif);
        metadata.addDirectory(exif);
        return metadata;
    }
}
