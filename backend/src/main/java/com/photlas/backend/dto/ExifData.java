package com.photlas.backend.dto;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Issue#132: 写真の EXIF 撮影情報のうち、カテゴリ判定に用いるタグを保持する DTO。
 *
 * <p>各フィールドは Optional とし、EXIF が剥がされた写真や該当タグがない場合は
 * {@link Optional#empty()} とする。</p>
 *
 * <p>不正値（負の値、極端な値、パース不能な日時など）も Optional.empty 扱い。
 * 値変換と妥当性チェックは {@link com.photlas.backend.service.ExifReader} が担う。</p>
 *
 * @param dateTimeOriginal    撮影日時（現地時刻として扱う。タイムゾーン情報は無し）
 * @param exposureTimeSeconds 露光時間（秒）。0 &lt; t ≤ 3600 の範囲のみ有効
 * @param iso                 ISO 感度。0 &lt; iso のみ有効
 * @param focalLength35mm     35mm 換算焦点距離（mm）。0 &lt; f のみ有効
 * @param gpsAltitude         GPS 標高（メートル）。|alt| ≤ 10000m のみ有効
 */
public record ExifData(
        Optional<LocalDateTime> dateTimeOriginal,
        Optional<Double> exposureTimeSeconds,
        Optional<Integer> iso,
        Optional<Integer> focalLength35mm,
        Optional<Double> gpsAltitude
) {

    /** 全フィールドが空の ExifData（EXIF 読み取りに失敗 / EXIF が剥がされた写真用）。 */
    public static ExifData empty() {
        return new ExifData(
                Optional.empty(), Optional.empty(),
                Optional.empty(), Optional.empty(), Optional.empty()
        );
    }

    public static Builder builder() {
        return new Builder();
    }

    /** ExifData を組み立てるビルダー。各 setter は値の妥当性を検証せずそのまま格納する。 */
    public static final class Builder {
        private Optional<LocalDateTime> dateTimeOriginal = Optional.empty();
        private Optional<Double> exposureTimeSeconds = Optional.empty();
        private Optional<Integer> iso = Optional.empty();
        private Optional<Integer> focalLength35mm = Optional.empty();
        private Optional<Double> gpsAltitude = Optional.empty();

        public Builder dateTimeOriginal(LocalDateTime value) {
            this.dateTimeOriginal = Optional.ofNullable(value);
            return this;
        }

        public Builder exposureTimeSeconds(double value) {
            this.exposureTimeSeconds = Optional.of(value);
            return this;
        }

        public Builder iso(int value) {
            this.iso = Optional.of(value);
            return this;
        }

        public Builder focalLength35mm(int value) {
            this.focalLength35mm = Optional.of(value);
            return this;
        }

        public Builder gpsAltitude(double value) {
            this.gpsAltitude = Optional.of(value);
            return this;
        }

        public ExifData build() {
            return new ExifData(dateTimeOriginal, exposureTimeSeconds, iso, focalLength35mm, gpsAltitude);
        }
    }
}
