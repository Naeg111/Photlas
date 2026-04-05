package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * S3ファイル存在確認のテスト
 * レポート#18 #1: createPhotoでS3上にファイルが存在するか確認する
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class PhotoS3ValidationTest {

    @Autowired
    private PhotoService photoService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @MockBean
    private S3Service s3Service;

    private User testUser;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("s3test");
        testUser.setEmail("s3test@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        Category category = new Category();
        category.setCategoryId(CodeConstants.CATEGORY_NATURE);
        category.setName("自然風景");
        categoryRepository.save(category);
    }

    @Test
    @DisplayName("S3にファイルが存在しないキーで投稿するとエラーになる")
    void testCreatePhoto_S3FileNotExists_ThrowsException() {
        String fakeS3Key = "uploads/" + testUser.getId() + "/nonexistent.jpg";
        when(s3Service.existsInS3(fakeS3Key)).thenReturn(false);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey(fakeS3Key);
        request.setTakenAt("2025-08-22T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("自然風景"));

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("S3");
    }

    @Test
    @DisplayName("S3にファイルが存在するキーで投稿すると正常に完了する")
    void testCreatePhoto_S3FileExists_Succeeds() {
        String validS3Key = "uploads/" + testUser.getId() + "/existing.jpg";
        when(s3Service.existsInS3(validS3Key)).thenReturn(true);
        when(s3Service.generateCdnUrl(org.mockito.ArgumentMatchers.anyString())).thenReturn("https://cdn.example.com/test.jpg");
        when(s3Service.generateThumbnailCdnUrl(org.mockito.ArgumentMatchers.anyString())).thenReturn("https://cdn.example.com/thumb.webp");

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey(validS3Key);
        request.setTakenAt("2025-08-22T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("自然風景"));

        var response = photoService.createPhoto(request, testUser.getEmail());
        org.assertj.core.api.Assertions.assertThat(response).isNotNull();
    }
}
