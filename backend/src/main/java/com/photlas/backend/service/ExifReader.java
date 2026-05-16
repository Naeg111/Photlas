package com.photlas.backend.service;

import com.drew.imaging.ImageMetadataReader;
import com.drew.lang.Rational;
import com.drew.metadata.Directory;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import com.drew.metadata.exif.ExifSubIFDDirectory;
import com.drew.metadata.exif.GpsDirectory;
import com.photlas.backend.dto.ExifData;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Optional;

/**
 * Issue#132: 画像バイト列から EXIF 撮影情報を読み取り、{@link ExifData} を返す。
 *
 * <p>役割は「バイト列 → POJO 変換」のみに限定。スコア補正の判定ロジックは
 * {@link ExifBasedCategoryHints} が担う（テスタビリティのため分離）。</p>
 *
 * <p>EXIF 読み取りに失敗した場合や該当タグが無い場合は {@link ExifData#empty()} 相当の
 * Optional.empty を持つフィールドを返す（例外は投げない）。</p>
 *
 * <p>本クラスはステートレスで、Spring の {@code @Component} としてシングルトン管理される。</p>
 */
@Component
public class ExifReader {

    private static final Logger logger = LoggerFactory.getLogger(ExifReader.class);

    /** EXIF 日時のフォーマット（例: "2026:05:16 22:30:15"）。 */
    private static final DateTimeFormatter EXIF_DATE_FORMAT =
            DateTimeFormatter.ofPattern("yyyy:MM:dd HH:mm:ss");

    /** Issue#132: 不正値判定用の閾値。露光時間の上限（秒）。 */
    private static final double EXPOSURE_TIME_MAX_SECONDS = 3600.0;

    /** Issue#132: 不正値判定用の閾値。GPS 標高の絶対値上限（メートル）。 */
    private static final double GPS_ALTITUDE_ABS_MAX = 10000.0;

    /**
     * 画像バイト列から EXIF を読み取る。
     *
     * @param imageBytes 元の画像バイト列（リサイズ前を推奨。EXIF はリサイズで失われることがある）
     * @return EXIF 抽出結果。読み取り失敗時は全フィールド空の {@link ExifData}
     */
    public ExifData read(byte[] imageBytes) {
        if (imageBytes == null || imageBytes.length == 0) {
            return ExifData.empty();
        }
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(imageBytes));
            return parseMetadata(metadata);
        } catch (Exception e) {
            // Issue#132 4.7: WARN レベルで残し、解析自体は継続
            logger.warn("EXIF 読み取りに失敗（解析は継続）: {}", e.getMessage());
            return ExifData.empty();
        }
    }

    /**
     * {@link Metadata} から {@link ExifData} を抽出する。テスト用に package-private 公開。
     */
    static ExifData parseMetadata(Metadata metadata) {
        ExifSubIFDDirectory subIfd = metadata.getFirstDirectoryOfType(ExifSubIFDDirectory.class);
        ExifIFD0Directory ifd0 = metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);
        GpsDirectory gps = metadata.getFirstDirectoryOfType(GpsDirectory.class);

        return new ExifData(
                extractDateTimeOriginal(subIfd, ifd0),
                extractExposureTime(subIfd),
                extractIso(subIfd),
                extractFocalLength35mm(subIfd),
                extractGpsAltitude(gps)
        );
    }

    /** SubIFD → IFD0 の順に DateTimeOriginal / DateTime を探す。 */
    private static Optional<LocalDateTime> extractDateTimeOriginal(
            ExifSubIFDDirectory subIfd, ExifIFD0Directory ifd0) {
        Optional<String> raw = readString(subIfd, ExifSubIFDDirectory.TAG_DATETIME_ORIGINAL)
                .or(() -> readString(ifd0, ExifIFD0Directory.TAG_DATETIME));
        return raw.flatMap(ExifReader::parseExifDateTime);
    }

    /** EXIF の "yyyy:MM:dd HH:mm:ss" 文字列を LocalDateTime にパースする。0000 始まりは empty。 */
    private static Optional<LocalDateTime> parseExifDateTime(String raw) {
        // "0000:00:00 00:00:00" などはパース不能 / 無意味とみなす
        if (raw == null || raw.startsWith("0000:")) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalDateTime.parse(raw, EXIF_DATE_FORMAT));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    private static Optional<Double> extractExposureTime(ExifSubIFDDirectory subIfd) {
        if (subIfd == null) {
            return Optional.empty();
        }
        Rational rational = subIfd.getRational(ExifSubIFDDirectory.TAG_EXPOSURE_TIME);
        if (rational == null) {
            return Optional.empty();
        }
        double seconds = rational.doubleValue();
        if (seconds <= 0.0 || seconds > EXPOSURE_TIME_MAX_SECONDS) {
            return Optional.empty();
        }
        return Optional.of(seconds);
    }

    private static Optional<Integer> extractIso(ExifSubIFDDirectory subIfd) {
        if (subIfd == null || !subIfd.containsTag(ExifSubIFDDirectory.TAG_ISO_EQUIVALENT)) {
            return Optional.empty();
        }
        try {
            int iso = subIfd.getInt(ExifSubIFDDirectory.TAG_ISO_EQUIVALENT);
            return iso > 0 ? Optional.of(iso) : Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static Optional<Integer> extractFocalLength35mm(ExifSubIFDDirectory subIfd) {
        if (subIfd == null
                || !subIfd.containsTag(ExifSubIFDDirectory.TAG_35MM_FILM_EQUIV_FOCAL_LENGTH)) {
            return Optional.empty();
        }
        try {
            int focal = subIfd.getInt(ExifSubIFDDirectory.TAG_35MM_FILM_EQUIV_FOCAL_LENGTH);
            return focal > 0 ? Optional.of(focal) : Optional.empty();
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private static Optional<Double> extractGpsAltitude(GpsDirectory gps) {
        if (gps == null) {
            return Optional.empty();
        }
        Rational rational = gps.getRational(GpsDirectory.TAG_ALTITUDE);
        if (rational == null) {
            return Optional.empty();
        }
        double altitude = rational.doubleValue();
        if (Math.abs(altitude) > GPS_ALTITUDE_ABS_MAX) {
            return Optional.empty();
        }
        return Optional.of(altitude);
    }

    private static Optional<String> readString(Directory directory, int tagType) {
        if (directory == null || !directory.containsTag(tagType)) {
            return Optional.empty();
        }
        String value = directory.getString(tagType);
        return Optional.ofNullable(value);
    }
}
