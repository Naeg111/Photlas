package com.photlas.backend.service;

import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#54: QuarantineServiceのユニットテスト
 */
@ExtendWith(MockitoExtension.class)
public class QuarantineServiceTest {

    @Mock
    private S3Service s3Service;

    @Mock
    private PhotoRepository photoRepository;

    @InjectMocks
    private QuarantineService quarantineService;

    private Photo testPhoto;

    @BeforeEach
    void setUp() {
        testPhoto = new Photo();
        testPhoto.setPhotoId(1L);
        testPhoto.setS3ObjectKey("uploads/1/abc.jpg");
    }

    // ===== quarantinePhoto テスト =====

    @Test
    @DisplayName("Issue#54 - 隔離時に元画像がquarantined/プレフィックスに移動される")
    void testQuarantinePhoto_MovesOriginalImage() {
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.quarantinePhoto(testPhoto);

        verify(s3Service).moveS3Object(
                eq("uploads/1/abc.jpg"),
                eq("quarantined/uploads/1/abc.jpg"));
    }

    @Test
    @DisplayName("Issue#54 - 隔離時にサムネイルがquarantined/プレフィックスに移動される")
    void testQuarantinePhoto_MovesThumbnail() {
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.quarantinePhoto(testPhoto);

        verify(s3Service).moveS3Object(
                eq("thumbnails/uploads/1/abc.webp"),
                eq("quarantined/thumbnails/uploads/1/abc.webp"));
    }

    @Test
    @DisplayName("Issue#54 - 隔離時にDBのs3_object_keyがquarantined/プレフィックス付きに更新される")
    void testQuarantinePhoto_UpdatesS3ObjectKey() {
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.quarantinePhoto(testPhoto);

        assertThat(testPhoto.getS3ObjectKey()).isEqualTo("quarantined/uploads/1/abc.jpg");
        verify(photoRepository).save(testPhoto);
    }

    // ===== restorePhoto テスト =====

    @Test
    @DisplayName("Issue#54 - 復元時に元画像がquarantined/プレフィックスから元の場所に戻される")
    void testRestorePhoto_MovesOriginalImageBack() {
        testPhoto.setS3ObjectKey("quarantined/uploads/1/abc.jpg");
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.restorePhoto(testPhoto);

        verify(s3Service).moveS3Object(
                eq("quarantined/uploads/1/abc.jpg"),
                eq("uploads/1/abc.jpg"));
    }

    @Test
    @DisplayName("Issue#54 - 復元時にサムネイルが元の場所に戻される")
    void testRestorePhoto_MovesThumbnailBack() {
        testPhoto.setS3ObjectKey("quarantined/uploads/1/abc.jpg");
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.restorePhoto(testPhoto);

        verify(s3Service).moveS3Object(
                eq("quarantined/thumbnails/uploads/1/abc.webp"),
                eq("thumbnails/uploads/1/abc.webp"));
    }

    @Test
    @DisplayName("Issue#54 - 復元時にDBのs3_object_keyからquarantined/プレフィックスが除去される")
    void testRestorePhoto_UpdatesS3ObjectKey() {
        testPhoto.setS3ObjectKey("quarantined/uploads/1/abc.jpg");
        when(photoRepository.save(testPhoto)).thenReturn(testPhoto);

        quarantineService.restorePhoto(testPhoto);

        assertThat(testPhoto.getS3ObjectKey()).isEqualTo("uploads/1/abc.jpg");
        verify(photoRepository).save(testPhoto);
    }

    // ===== ヘルパーメソッドテスト =====

    @Test
    @DisplayName("Issue#54 - toQuarantinedKeyでプレフィックスが付与される")
    void testToQuarantinedKey() {
        assertThat(quarantineService.toQuarantinedKey("uploads/1/abc.jpg"))
                .isEqualTo("quarantined/uploads/1/abc.jpg");
    }

    @Test
    @DisplayName("Issue#54 - toQuarantinedKeyで既にプレフィックスがある場合は二重付与されない")
    void testToQuarantinedKey_AlreadyQuarantined() {
        assertThat(quarantineService.toQuarantinedKey("quarantined/uploads/1/abc.jpg"))
                .isEqualTo("quarantined/uploads/1/abc.jpg");
    }

    @Test
    @DisplayName("Issue#54 - fromQuarantinedKeyでプレフィックスが除去される")
    void testFromQuarantinedKey() {
        assertThat(quarantineService.fromQuarantinedKey("quarantined/uploads/1/abc.jpg"))
                .isEqualTo("uploads/1/abc.jpg");
    }

    @Test
    @DisplayName("Issue#54 - fromQuarantinedKeyでプレフィックスがない場合はそのまま返す")
    void testFromQuarantinedKey_NotQuarantined() {
        assertThat(quarantineService.fromQuarantinedKey("uploads/1/abc.jpg"))
                .isEqualTo("uploads/1/abc.jpg");
    }

    @Test
    @DisplayName("Issue#54 - toThumbnailKeyで正しいサムネイルキーが導出される")
    void testToThumbnailKey() {
        assertThat(quarantineService.toThumbnailKey("uploads/1/abc.jpg"))
                .isEqualTo("thumbnails/uploads/1/abc.webp");
    }

    @Test
    @DisplayName("Issue#54 - toThumbnailKeyでquarantined/プレフィックス付きキーも正しく変換される")
    void testToThumbnailKey_Quarantined() {
        assertThat(quarantineService.toThumbnailKey("quarantined/uploads/1/abc.jpg"))
                .isEqualTo("thumbnails/quarantined/uploads/1/abc.webp");
    }
}
