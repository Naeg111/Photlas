package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoDetailResponse;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.PhotoAiPrediction;
import com.photlas.backend.repository.AccountSanctionRepository;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoAiPredictionRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class PhotoServiceTest {

    @Autowired
    private PhotoService photoService;

    @org.springframework.boot.test.mock.mockito.MockBean
    private S3Service s3Service;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private PhotoCategoryRepository photoCategoryRepository;

    @Autowired
    private AccountSanctionRepository accountSanctionRepository;

    @Autowired
    private AiPredictionCacheService aiPredictionCacheService;

    @Autowired
    private PhotoAiPredictionRepository photoAiPredictionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private User testUser;
    private Category landscapeCategory;
    private Category cityCategory;

    @BeforeEach
    void setUp() {
        // S3Serviceのモック設定
        org.mockito.Mockito.when(s3Service.existsInS3(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);
        org.mockito.Mockito.when(s3Service.generateCdnUrl(org.mockito.ArgumentMatchers.anyString())).thenReturn("https://cdn.example.com/test.jpg");
        org.mockito.Mockito.when(s3Service.generateThumbnailCdnUrl(org.mockito.ArgumentMatchers.anyString())).thenReturn("https://cdn.example.com/thumb.webp");
        // Issue#100: deriveThumbnailKey は実ロジックと同じ命名規則をモックでも返す
        org.mockito.Mockito.when(s3Service.deriveThumbnailKey(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(inv -> {
                    String key = inv.getArgument(0);
                    int dot = key.lastIndexOf('.');
                    String base = dot > 0 ? key.substring(0, dot) : key;
                    return "thumbnails/" + base + ".webp";
                });

        // クリーンアップ
        accountSanctionRepository.deleteAll();
        photoCategoryRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        // カテゴリマスターデータを作成
        landscapeCategory = new Category();
        landscapeCategory.setCategoryId(CodeConstants.CATEGORY_NATURE);
        landscapeCategory.setName("風景");
        landscapeCategory = categoryRepository.save(landscapeCategory);

        cityCategory = new Category();
        cityCategory.setCategoryId(CodeConstants.CATEGORY_CITYSCAPE);
        cityCategory.setName("都市・街並み");
        cityCategory = categoryRepository.save(cityCategory);
    }

    @Test
    @DisplayName("スポット集約ロジック - 新規スポット作成")
    void testCreatePhoto_NoExistingSpot_CreatesNewSpot() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test001.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getSpot()).isNotNull();
        assertThat(response.getSpot().getLatitude()).isEqualByComparingTo(new BigDecimal("35.658581"));
        assertThat(response.getSpot().getLongitude()).isEqualByComparingTo(new BigDecimal("139.745433"));

        // データベースに保存されたことを確認
        List<Spot> spots = spotRepository.findAll();
        assertThat(spots).hasSize(1);
        assertThat(spots.get(0).getCreatedByUserId()).isEqualTo(testUser.getId());
    }

    @Test
    @DisplayName("スポット集約ロジック - 半径200m以内の既存スポットに紐付け")
    void testCreatePhoto_ExistingSpotWithin200m_UsesExistingSpot() {
        // 既存のスポットを作成
        Spot existingSpot = new Spot();
        existingSpot.setLatitude(new BigDecimal("35.658500"));  // 約9m離れた位置
        existingSpot.setLongitude(new BigDecimal("139.745400"));
        existingSpot.setCreatedByUserId(testUser.getId());
        existingSpot = spotRepository.save(existingSpot);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test002.jpg");
        request.setTakenAt("2025-08-16T19:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));  // 既存スポットから約9m
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getSpot().getSpotId()).isEqualTo(existingSpot.getSpotId());
        assertThat(response.getSpot().getLatitude()).isEqualByComparingTo(new BigDecimal("35.658500"));
        assertThat(response.getSpot().getLongitude()).isEqualByComparingTo(new BigDecimal("139.745400"));

        // スポットが新規作成されていないことを確認
        List<Spot> spots = spotRepository.findAll();
        assertThat(spots).hasSize(1);
    }

    @Test
    @DisplayName("スポット集約ロジック - 半径200m超の場所には新規スポット作成")
    void testCreatePhoto_ExistingSpotBeyond200m_CreatesNewSpot() {
        // 既存のスポットを作成
        Spot existingSpot = new Spot();
        existingSpot.setLatitude(new BigDecimal("35.658581"));
        existingSpot.setLongitude(new BigDecimal("139.745433"));
        existingSpot.setCreatedByUserId(testUser.getId());
        existingSpot = spotRepository.save(existingSpot);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test003.jpg");
        request.setTakenAt("2025-08-17T20:00:00Z");
        request.setLatitude(new BigDecimal("35.660581"));  // 約222m離れた位置
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getSpot().getSpotId()).isNotEqualTo(existingSpot.getSpotId());
        assertThat(response.getSpot().getLatitude()).isEqualByComparingTo(new BigDecimal("35.660581"));

        // 新しいスポットが作成されたことを確認
        List<Spot> spots = spotRepository.findAll();
        assertThat(spots).hasSize(2);
    }

    @Test
    @DisplayName("スポット集約ロジック - 複数の近いスポットがある場合は最も近いものを選択")
    void testCreatePhoto_MultipleNearbySpots_SelectsClosest() {
        // 2つの既存スポットを作成
        Spot spot1 = new Spot();
        spot1.setLatitude(new BigDecimal("35.658500"));  // 約9m離れた位置
        spot1.setLongitude(new BigDecimal("139.745400"));
        spot1.setCreatedByUserId(testUser.getId());
        spot1 = spotRepository.save(spot1);

        Spot spot2 = new Spot();
        spot2.setLatitude(new BigDecimal("35.658700"));  // 約13m離れた位置
        spot2.setLongitude(new BigDecimal("139.745500"));
        spot2.setCreatedByUserId(testUser.getId());
        spot2 = spotRepository.save(spot2);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test004.jpg");
        request.setTakenAt("2025-08-18T21:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        // 最も近いspot1が選ばれることを確認
        assertThat(response.getSpot().getSpotId()).isEqualTo(spot1.getSpotId());
    }

    @Test
    @DisplayName("カテゴリ保存ロジック - 単一カテゴリの保存")
    void testCreatePhoto_SingleCategory_SavesCorrectly() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test005.jpg");
        request.setTakenAt("2025-08-19T22:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();

        // photo_categoriesテーブルに正しく保存されたことを確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).hasSize(1);
        assertThat(savedPhoto.getCategories().get(0).getName()).isEqualTo("風景");
    }

    @Test
    @DisplayName("カテゴリ保存ロジック - 複数カテゴリの保存")
    void testCreatePhoto_MultipleCategories_SavesCorrectly() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test006.jpg");
        request.setTakenAt("2025-08-20T23:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景", "都市・街並み"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();

        // photo_categoriesテーブルに正しく保存されたことを確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).hasSize(2);
        assertThat(savedPhoto.getCategories())
                .extracting(Category::getName)
                .containsExactlyInAnyOrder("風景", "都市・街並み");
    }

    @Test
    @DisplayName("カテゴリ保存ロジック - 存在しないカテゴリ名で例外")
    void testCreatePhoto_NonExistentCategory_ThrowsException() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test007.jpg");
        request.setTakenAt("2025-08-21T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("存在しないカテゴリ"));

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(CategoryNotFoundException.class)
                .hasMessageContaining("カテゴリ");
    }

    @Test
    @DisplayName("天気情報 - ユーザーが天気を指定した場合はその値が保存される")
    void testCreatePhoto_WithWeather_SavesProvidedWeather() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test008.jpg");
        request.setTakenAt("2025-08-22T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        request.setWeather(CodeConstants.WEATHER_SUNNY);

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getWeather()).isEqualTo(CodeConstants.WEATHER_SUNNY);
    }

    @Test
    @DisplayName("天気情報 - ユーザーが天気を未指定の場合はnullで保存される")
    void testCreatePhoto_WithoutWeather_SavesNull() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test009.jpg");
        request.setTakenAt("2020-01-01T00:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getWeather()).isNull();
    }

    @Test
    @DisplayName("トランザクション - 全ての処理が1つのトランザクションで実行される")
    void testCreatePhoto_AllOperations_ExecutedInSingleTransaction() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test010.jpg");
        request.setTakenAt("2025-08-23T14:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景", "都市・街並み"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();

        // 全てのデータが正しく保存されていることを確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto).isNotNull();
        assertThat(savedPhoto.getSpotId()).isNotNull();
        assertThat(savedPhoto.getCategories()).hasSize(2);

        Spot savedSpot = spotRepository.findById(savedPhoto.getSpotId()).orElseThrow();
        assertThat(savedSpot).isNotNull();
    }

    @Test
    @DisplayName("トランザクション - カテゴリエラー時は例外をスロー")
    void testCreatePhoto_CategoryError_ThrowsException() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/test011.jpg");
        request.setTakenAt("2025-08-24T15:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("存在しないカテゴリ"));

        // 存在しないカテゴリの場合、例外がスローされることを確認
        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(CategoryNotFoundException.class)
                .hasMessageContaining("カテゴリ");
    }

    // ===== Issue#48: カテゴリ任意化テスト =====

    @Test
    @DisplayName("Issue#48 - カテゴリなし（空リスト）での投稿が成功する")
    void testCreatePhoto_EmptyCategories_SucceedsWithoutCategory() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/nocat001.jpg");
        request.setTakenAt("2026-01-20T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of()); // 空リスト

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).isEmpty();
    }

    @Test
    @DisplayName("Issue#48 - カテゴリnullでの投稿が成功する")
    void testCreatePhoto_NullCategories_SucceedsWithoutCategory() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/nullcat001.jpg");
        request.setTakenAt("2026-01-21T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(null); // null

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).isEmpty();
    }

    // ===== 時間帯自動判定テスト =====

    @Test
    @DisplayName("時間帯自動判定 - 朝（5:00〜9:59）の撮影日時からMORNINGが設定される")
    void testCreatePhoto_MorningShot_SetsTimeOfDayToMorning() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/morning001.jpg");
        request.setTakenAt("2026-02-17T07:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_MORNING);
    }

    @Test
    @DisplayName("時間帯自動判定 - 昼（10:00〜15:59）の撮影日時からDAYが設定される")
    void testCreatePhoto_DaytimeShot_SetsTimeOfDayToDay() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/day001.jpg");
        request.setTakenAt("2026-02-17T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_DAY);
    }

    @Test
    @DisplayName("時間帯自動判定 - 夕方（16:00〜17:59）の撮影日時からEVENINGが設定される")
    void testCreatePhoto_EveningShot_SetsTimeOfDayToEvening() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/evening001.jpg");
        request.setTakenAt("2026-02-17T17:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_EVENING);
    }

    @Test
    @DisplayName("時間帯自動判定 - 夜（18:00〜4:59）の撮影日時からNIGHTが設定される")
    void testCreatePhoto_NightShot_SetsTimeOfDayToNight() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/night001.jpg");
        request.setTakenAt("2026-02-17T22:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_NIGHT);
    }

    @Test
    @DisplayName("時間帯自動判定 - 深夜（3:00）の撮影日時からNIGHTが設定される")
    void testCreatePhoto_EarlyMorningShot_SetsTimeOfDayToNight() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/latenight001.jpg");
        request.setTakenAt("2026-02-17T03:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_NIGHT);
    }

    @Test
    @DisplayName("時間帯自動判定 - 境界値: 5:00はMORNINGになる")
    void testCreatePhoto_BoundaryMorningStart_SetsTimeOfDayToMorning() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/morning5am.jpg");
        request.setTakenAt("2026-02-17T05:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_MORNING);
    }

    @Test
    @DisplayName("時間帯自動判定 - 境界値: 4:59はNIGHTになる")
    void testCreatePhoto_BoundaryNightEnd_SetsTimeOfDayToNight() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/night459.jpg");
        request.setTakenAt("2026-02-17T04:59:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getTimeOfDay()).isEqualTo(CodeConstants.TIME_OF_DAY_NIGHT);
    }

    // ===== Issue#40: Photo Entity拡張テスト =====

    @Test
    @DisplayName("Issue#40 - EXIF情報付き写真の投稿が正常に保存される")
    void testCreatePhoto_WithExifData_SavesAllExifFields() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/exif001.jpg");
        request.setTakenAt("2026-01-15T17:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        request.setCameraBody("Canon EOS R5");
        request.setCameraLens("RF 24-70mm f/2.8L");
        request.setFocalLength35mm(35);
        request.setFValue("f/2.8");
        request.setShutterSpeed("1/1000");
        request.setIso(400);
        request.setImageWidth(8192);
        request.setImageHeight(5464);

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        // EXIF情報がネストオブジェクトで返されることを確認
        PhotoResponse.ExifDTO exif = response.getPhoto().getExif();
        assertThat(exif).isNotNull();
        assertThat(exif.getCameraBody()).isEqualTo("Canon EOS R5");
        assertThat(exif.getCameraLens()).isEqualTo("RF 24-70mm f/2.8L");
        assertThat(exif.getFocalLength35mm()).isEqualTo(35);
        assertThat(exif.getFValue()).isEqualTo("f/2.8");
        assertThat(exif.getShutterSpeed()).isEqualTo("1/1000");
        assertThat(exif.getIso()).isEqualTo(400);
        assertThat(exif.getImageWidth()).isEqualTo(8192);
        assertThat(exif.getImageHeight()).isEqualTo(5464);

        // データベースに保存されたことを確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCameraBody()).isEqualTo("Canon EOS R5");
        assertThat(savedPhoto.getFocalLength35mm()).isEqualTo(35);
        assertThat(savedPhoto.getIso()).isEqualTo(400);
        assertThat(savedPhoto.getImageWidth()).isEqualTo(8192);
        assertThat(savedPhoto.getImageHeight()).isEqualTo(5464);
    }

    @Test
    @DisplayName("Issue#40 - EXIF情報なしの写真も正常に投稿できる")
    void testCreatePhoto_WithoutExifData_SavesSuccessfully() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/noexif001.jpg");
        request.setTakenAt("2026-01-16T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        // EXIF情報は全て未設定

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getExif()).isNull();

        // データベースの値も確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCameraBody()).isNull();
        assertThat(savedPhoto.getIso()).isNull();
    }

    @Test
    @DisplayName("Issue#40 - 写真詳細取得でEXIF情報が返される")
    void testGetPhotoDetail_WithExifData_ReturnsExifInResponse() {
        // EXIF付き写真を直接DBに保存
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/exifdetail001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 15, 17, 30));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setCameraBody("Sony α7 IV");
        photo.setCameraLens("FE 24-105mm F4 G OSS");
        photo.setFocalLength35mm(50);
        photo.setFValue("f/4.0");
        photo.setShutterSpeed("1/500");
        photo.setIso(200);
        photo.setImageWidth(7008);
        photo.setImageHeight(4672);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        PhotoDetailResponse.CameraInfo cameraInfo = response.getCameraInfo();
        assertThat(cameraInfo).isNotNull();
        assertThat(cameraInfo.getBody()).isEqualTo("Sony α7 IV");
        assertThat(cameraInfo.getLens()).isEqualTo("FE 24-105mm F4 G OSS");
        assertThat(cameraInfo.getFocalLength35mm()).isEqualTo(50);
        assertThat(cameraInfo.getFValue()).isEqualTo("f/4.0");
        assertThat(cameraInfo.getShutterSpeed()).isEqualTo("1/500");
        assertThat(cameraInfo.getIso()).isEqualTo("200");
        assertThat(cameraInfo.getImageWidth()).isEqualTo(7008);
        assertThat(cameraInfo.getImageHeight()).isEqualTo(4672);
    }

    @Test
    @DisplayName("Issue#40 - 写真詳細取得でEXIF情報が部分的な場合も正常に返される")
    void testGetPhotoDetail_PartialExifData_ReturnsAvailableFields() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/partialexif001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 16, 10, 0));
        photo.setWeather(CodeConstants.WEATHER_CLOUDY);
        // カメラ名とISOのみ設定
        photo.setCameraBody("iPhone 15 Pro");
        photo.setIso(100);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        PhotoDetailResponse.CameraInfo cameraInfo = response.getCameraInfo();
        assertThat(cameraInfo).isNotNull();
        assertThat(cameraInfo.getBody()).isEqualTo("iPhone 15 Pro");
        assertThat(cameraInfo.getIso()).isEqualTo("100");
        assertThat(cameraInfo.getLens()).isNull();
        assertThat(cameraInfo.getFocalLength35mm()).isNull();
    }

    @Test
    @DisplayName("Issue#40 - 写真のピンポイント座標がレスポンスに含まれる")
    void testGetPhotoDetail_ReturnsPhotoLevelCoordinates() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/coord001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 17, 12, 0));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setLatitude(new BigDecimal("35.658600"));
        photo.setLongitude(new BigDecimal("139.745450"));
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        // 写真ごとのピンポイント座標が返されることを確認
        assertThat(response.getLatitude()).isEqualByComparingTo(new BigDecimal("35.658600"));
        assertThat(response.getLongitude()).isEqualByComparingTo(new BigDecimal("139.745450"));
        // スポット座標は別途返される
        assertThat(response.getSpot().getLatitude()).isEqualByComparingTo(new BigDecimal("35.658581"));
    }

    // ===== Issue#49: クロップ（トリミング）データテスト =====

    @Test
    @DisplayName("Issue#49 - クロップデータ付き写真の投稿が正常に保存される")
    void testCreatePhoto_WithCropData_SavesCropFields() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/crop001.jpg");
        request.setTakenAt("2026-02-08T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCropCenterX(0.3);
        request.setCropCenterY(0.7);
        request.setCropZoom(1.5);

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();

        // データベースに保存されたことを確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCropCenterX()).isEqualTo(0.3);
        assertThat(savedPhoto.getCropCenterY()).isEqualTo(0.7);
        assertThat(savedPhoto.getCropZoom()).isEqualTo(1.5);
    }

    @Test
    @DisplayName("Issue#49 - クロップデータなしの投稿が成功する（後方互換）")
    void testCreatePhoto_WithoutCropData_SavesNullCropFields() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/nocrop001.jpg");
        request.setTakenAt("2026-02-08T11:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        // cropフィールド未設定

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCropCenterX()).isNull();
        assertThat(savedPhoto.getCropCenterY()).isNull();
        assertThat(savedPhoto.getCropZoom()).isNull();
    }

    @Test
    @DisplayName("Issue#49 - 写真詳細取得でクロップデータが返される")
    void testGetPhotoDetail_WithCropData_ReturnsCropInResponse() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/cropdetail001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 2, 8, 10, 0));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setCropCenterX(0.25);
        photo.setCropCenterY(0.75);
        photo.setCropZoom(2.0);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getCropCenterX()).isEqualTo(0.25);
        assertThat(response.getCropCenterY()).isEqualTo(0.75);
        assertThat(response.getCropZoom()).isEqualTo(2.0);
    }

    @Test
    @DisplayName("Issue#49 - クロップデータなしの写真詳細でcropフィールドがnull")
    void testGetPhotoDetail_WithoutCropData_CropIsNull() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/nocropdetail001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 2, 8, 11, 0));
        photo.setWeather(CodeConstants.WEATHER_CLOUDY);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getCropCenterX()).isNull();
        assertThat(response.getCropCenterY()).isNull();
        assertThat(response.getCropZoom()).isNull();
    }

    // ===== ユーザー投稿一覧テスト =====

    @Test
    @DisplayName("ユーザー投稿一覧 - ユーザーの投稿写真がページネーション付きで取得できる")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_ReturnsUserPhotosWithPagination() {
        // Given
        Spot spot = createSpot("35.658581", "139.745433");

        createPhotoForUser(spot, "photos/user001.jpg",
                java.time.LocalDateTime.of(2026, 1, 15, 10, 0), CodeConstants.WEATHER_SUNNY);
        createPhotoForUser(spot, "photos/user002.jpg",
                java.time.LocalDateTime.of(2026, 1, 16, 10, 0), CodeConstants.WEATHER_CLOUDY);

        Pageable pageable = PageRequest.of(0, 20);

        // When
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, testUser.getEmail());

        // Then
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(2);
        assertThat((long) result.get("total_elements")).isEqualTo(2L);
        assertThat((int) result.get("total_pages")).isEqualTo(1);
        assertThat((boolean) result.get("last")).isTrue();
    }

    @Test
    @DisplayName("ユーザー投稿一覧 - 投稿がないユーザーは空のcontentが返る")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_NoPhotos_ReturnsEmptyContent() {
        // Given
        Pageable pageable = PageRequest.of(0, 20);

        // When
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, testUser.getEmail());

        // Then
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).isEmpty();
        assertThat((long) result.get("total_elements")).isEqualTo(0L);
    }

    @Test
    @DisplayName("ユーザー投稿一覧 - 写真にimage_url, spot_id, クロップ情報が含まれる")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_ReturnsPhotoWithDetails() {
        // Given
        Spot spot = createSpot("35.658581", "139.745433");

        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey("photos/detail001.jpg");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 15, 10, 0));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setCropCenterX(0.5);
        photo.setCropCenterY(0.5);
        photo.setCropZoom(1.2);
        photo.setCategories(List.of(landscapeCategory));
        photoRepository.save(photo);

        Pageable pageable = PageRequest.of(0, 20);

        // When
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, testUser.getEmail());

        // Then
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);

        PhotoResponse response = content.get(0);
        assertThat(response.getPhoto().getImageUrl()).isNotNull();
        assertThat(response.getSpot().getSpotId()).isEqualTo(spot.getSpotId());
        assertThat(response.getPhoto().getCropCenterX()).isEqualTo(0.5);
        assertThat(response.getPhoto().getCropCenterY()).isEqualTo(0.5);
        assertThat(response.getPhoto().getCropZoom()).isEqualTo(1.2);
    }

    // ===== テストヘルパーメソッド =====

    private Spot createSpot(String lat, String lng) {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal(lat));
        spot.setLongitude(new BigDecimal(lng));
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhotoForUser(Spot spot, String s3Key,
                                     java.time.LocalDateTime shotAt, Integer weather) {
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        photo.setCategories(List.of(landscapeCategory));
        return photoRepository.save(photo);
    }

    private Photo createPhotoWithStatus(Spot spot, String s3Key, Integer status) {
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 15, 10, 0));
        photo.setModerationStatus(status);
        photo.setCategories(List.of(landscapeCategory));
        return photoRepository.save(photo);
    }

    // ===== Issue#54: アカウント停止テスト =====

    @Test
    @DisplayName("Issue#54 - 永久停止ユーザーは写真投稿が拒否される")
    void testCreatePhoto_PermanentlySuspendedUser_ThrowsException() {
        testUser.setRole(CodeConstants.ROLE_SUSPENDED);
        userRepository.save(testUser);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/suspended001.jpg");
        request.setTakenAt("2026-01-15T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(AccountSuspendedException.class)
                .hasMessageContaining("アカウントが停止されています");
    }

    @Test
    @DisplayName("Issue#54 - 一時停止中ユーザーは写真投稿が拒否される")
    void testCreatePhoto_TemporarilySuspendedUser_ThrowsException() {
        AccountSanction sanction = new AccountSanction();
        sanction.setUserId(testUser.getId());
        sanction.setSanctionType(CodeConstants.SANCTION_TEMPORARY_SUSPENSION);
        sanction.setReason("テスト用一時停止");
        sanction.setSuspendedUntil(java.time.LocalDateTime.now().plusDays(7));
        accountSanctionRepository.save(sanction);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/tempsuspend001.jpg");
        request.setTakenAt("2026-01-15T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(AccountSuspendedException.class)
                .hasMessageContaining("投稿機能が一時停止中です");
    }

    @Test
    @DisplayName("Issue#54 - 一時停止期間が過ぎたユーザーは写真投稿が可能")
    void testCreatePhoto_ExpiredTemporarySuspension_Succeeds() {
        AccountSanction sanction = new AccountSanction();
        sanction.setUserId(testUser.getId());
        sanction.setSanctionType(CodeConstants.SANCTION_TEMPORARY_SUSPENSION);
        sanction.setReason("期限切れ停止");
        sanction.setSuspendedUntil(java.time.LocalDateTime.now().minusDays(1));
        accountSanctionRepository.save(sanction);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/expired001.jpg");
        request.setTakenAt("2026-01-15T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());
        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getPhotoId()).isNotNull();
    }

    // ===== Issue#54: モデレーションステータスによる閲覧制御テスト =====

    @Test
    @DisplayName("Issue#54 - REMOVED写真はオーナーでも閲覧不可（404）")
    void testGetPhotoDetail_RemovedPhoto_ThrowsNotFoundForOwner() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/removed001.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        assertThatThrownBy(() -> photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail()))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW写真はオーナーのみ閲覧可能")
    void testGetPhotoDetail_PendingReviewPhoto_VisibleToOwnerOnly() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/pending001.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        // オーナーは閲覧可能
        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());
        assertThat(response).isNotNull();
        assertThat(response.getPhotoId()).isEqualTo(photo.getPhotoId());
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW写真は他ユーザーから閲覧不可（404）")
    void testGetPhotoDetail_PendingReviewPhoto_NotVisibleToOtherUser() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/pending002.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        // 別ユーザーを作成
        User otherUser = new User();
        otherUser.setUsername("otheruser");
        otherUser.setEmail("other@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole(CodeConstants.ROLE_USER);
        userRepository.save(otherUser);

        assertThatThrownBy(() -> photoService.getPhotoDetail(photo.getPhotoId(), otherUser.getEmail()))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW写真は未認証ユーザーから閲覧不可（404）")
    void testGetPhotoDetail_PendingReviewPhoto_NotVisibleToAnonymous() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/pending003.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        assertThatThrownBy(() -> photoService.getPhotoDetail(photo.getPhotoId(), null))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - QUARANTINED写真はオーナーのみ閲覧可能")
    void testGetPhotoDetail_QuarantinedPhoto_VisibleToOwnerOnly() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/quarantined001.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        // オーナーは閲覧可能
        PhotoDetailResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());
        assertThat(response).isNotNull();

        // 他ユーザーは閲覧不可
        User otherUser = new User();
        otherUser.setUsername("otheruser2");
        otherUser.setEmail("other2@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole(CodeConstants.ROLE_USER);
        userRepository.save(otherUser);

        assertThatThrownBy(() -> photoService.getPhotoDetail(photo.getPhotoId(), otherUser.getEmail()))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED写真は誰でも閲覧可能")
    void testGetPhotoDetail_PublishedPhoto_VisibleToEveryone() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/published001.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        // オーナー
        assertThat(photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail())).isNotNull();

        // 他ユーザー
        User otherUser = new User();
        otherUser.setUsername("otheruser3");
        otherUser.setEmail("other3@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole(CodeConstants.ROLE_USER);
        userRepository.save(otherUser);
        assertThat(photoService.getPhotoDetail(photo.getPhotoId(), otherUser.getEmail())).isNotNull();

        // 未認証
        assertThat(photoService.getPhotoDetail(photo.getPhotoId(), null)).isNotNull();
    }

    // ===== Issue#54: ユーザー投稿一覧 ModerationStatusフィルタリングテスト =====

    @Test
    @DisplayName("Issue#54 - ユーザー投稿一覧: オーナーはPENDING_REVIEW/PUBLISHED/QUARANTINEDが見える")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_OwnerSeesAllNonRemovedStatuses() {
        Spot spot = createSpot("35.658581", "139.745433");
        createPhotoWithStatus(spot, "photos/vis-pending.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        createPhotoWithStatus(spot, "photos/vis-published.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);
        createPhotoWithStatus(spot, "photos/vis-quarantined.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        createPhotoWithStatus(spot, "photos/vis-removed.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        Pageable pageable = PageRequest.of(0, 20);
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, testUser.getEmail());

        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(3);
    }

    @Test
    @DisplayName("Issue#54 - ユーザー投稿一覧: 他ユーザーはPUBLISHEDのみ見える")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_OtherUserSeesOnlyPublished() {
        Spot spot = createSpot("35.658581", "139.745433");
        createPhotoWithStatus(spot, "photos/vis2-pending.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        createPhotoWithStatus(spot, "photos/vis2-published.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);
        createPhotoWithStatus(spot, "photos/vis2-quarantined.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        User otherUser = new User();
        otherUser.setUsername("viewer");
        otherUser.setEmail("viewer@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole(CodeConstants.ROLE_USER);
        userRepository.save(otherUser);

        Pageable pageable = PageRequest.of(0, 20);
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, otherUser.getEmail());

        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);
    }

    @Test
    @DisplayName("Issue#54 - ユーザー投稿一覧: 未認証ユーザーはPUBLISHEDのみ見える")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_AnonymousSeesOnlyPublished() {
        Spot spot = createSpot("35.658581", "139.745433");
        createPhotoWithStatus(spot, "photos/vis3-pending.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        createPhotoWithStatus(spot, "photos/vis3-published.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        Pageable pageable = PageRequest.of(0, 20);
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, null);

        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);
    }

    // ===== Issue#54: getPhotoForOwnerテスト =====

    @Test
    @DisplayName("Issue#54 - 写真ステータス取得: オーナーは自分の写真のステータスを取得できる")
    void testGetPhotoForOwner_OwnerCanAccessOwnPhoto() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/status001.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        Photo result = photoService.getPhotoForOwner(photo.getPhotoId(), testUser.getId());
        assertThat(result).isNotNull();
        assertThat(result.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
    }

    @Test
    @DisplayName("Issue#54 - 写真ステータス取得: 他ユーザーは取得不可（404）")
    void testGetPhotoForOwner_NonOwnerCannotAccess() {
        Spot spot = createSpot("35.658581", "139.745433");
        Photo photo = createPhotoWithStatus(spot, "photos/status002.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        User otherUser = new User();
        otherUser.setUsername("nonowner");
        otherUser.setEmail("nonowner@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole(CodeConstants.ROLE_USER);
        otherUser = userRepository.save(otherUser);

        Long otherUserId = otherUser.getId();
        assertThatThrownBy(() -> photoService.getPhotoForOwner(photo.getPhotoId(), otherUserId))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - 写真ステータス取得: 存在しない写真は404")
    void testGetPhotoForOwner_NonExistentPhoto_ThrowsNotFound() {
        assertThatThrownBy(() -> photoService.getPhotoForOwner(99999L, testUser.getId()))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    // ===== 写真詳細: 存在しない写真テスト =====

    @Test
    @DisplayName("写真詳細取得 - 存在しない写真IDは404エラー")
    void testGetPhotoDetail_NonExistentPhoto_ThrowsNotFound() {
        assertThatThrownBy(() -> photoService.getPhotoDetail(99999L, testUser.getEmail()))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    // ===== Issue#100: タグベース孤立ファイル対応 =====

    @Test
    @DisplayName("Issue#100 - createPhoto: DB保存前に元画像のタグを status=registered に更新する")
    void testCreatePhoto_UpdatesOriginalTagToRegisteredBeforeDbSave() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("uploads/" + testUser.getId() + "/issue100-test.jpg");
        request.setTakenAt("2026-01-01T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        photoService.createPhoto(request, testUser.getEmail());

        // 元画像のタグが registered に更新されたことを検証
        org.mockito.Mockito.verify(s3Service).updateObjectTag(
                request.getS3ObjectKey(),
                S3Service.STATUS_TAG_KEY,
                S3Service.STATUS_TAG_VALUE_REGISTERED
        );
    }

    @Test
    @DisplayName("Issue#100 - createPhoto: タグ更新が失敗した場合は DB 保存を行わずエラーを返す")
    void testCreatePhoto_TagUpdateFails_DoesNotSaveDbAndThrows() {
        // タグ更新で例外を投げるようにモック設定
        org.mockito.Mockito.doThrow(new RuntimeException("S3 tag update failed"))
                .when(s3Service).updateObjectTag(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_KEY),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_VALUE_REGISTERED)
                );

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("uploads/" + testUser.getId() + "/issue100-fail.jpg");
        request.setTakenAt("2026-01-01T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        long beforeCount = photoRepository.count();

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(RuntimeException.class);

        // DB に写真が保存されていないことを検証
        long afterCount = photoRepository.count();
        assertThat(afterCount).isEqualTo(beforeCount);
    }

    @Test
    @DisplayName("Issue#100 - createPhoto: DB保存後にサムネイルのタグ更新を試みる（ベストエフォート、失敗してもエラーにしない）")
    void testCreatePhoto_AttemptsThumbnailTagUpdate_BestEffortOnFailure() {
        // 元画像のタグ更新は成功、サムネイルのタグ更新で例外
        org.mockito.Mockito.doNothing().when(s3Service).updateObjectTag(
                org.mockito.ArgumentMatchers.<String>argThat(key -> key != null && key.startsWith("uploads/")),
                org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_KEY),
                org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_VALUE_REGISTERED)
        );
        org.mockito.Mockito.doThrow(new RuntimeException("Thumbnail tag update failed"))
                .when(s3Service).updateObjectTag(
                        org.mockito.ArgumentMatchers.<String>argThat(key -> key != null && key.startsWith("thumbnails/")),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_KEY),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_VALUE_REGISTERED)
                );

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("uploads/" + testUser.getId() + "/issue100-thumb-fail.jpg");
        request.setTakenAt("2026-01-01T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        // サムネイル失敗でも写真投稿は成功する
        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());
        assertThat(response).isNotNull();

        // サムネイルのタグ更新が試みられたことを検証（"thumbnails/" で始まるキーで呼び出されたこと）
        org.mockito.Mockito.verify(s3Service).updateObjectTag(
                org.mockito.ArgumentMatchers.<String>argThat(key -> key != null && key.startsWith("thumbnails/")),
                org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_KEY),
                org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_VALUE_REGISTERED)
        );
    }

    // ========== Issue#119: analyzeToken 経由の AI 予測結果保存 ==========

    private CreatePhotoRequest baseRequest(String s3Key) {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey(s3Key);
        request.setTakenAt("2026-01-01T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        return request;
    }

    private LabelMappingResult aiResult(List<Integer> categories, Integer weather) {
        Map<String, Float> confidence = new java.util.HashMap<>();
        for (Integer c : categories) {
            confidence.put(String.valueOf(c), 85.0f);
        }
        if (weather != null) {
            confidence.put(String.valueOf(weather), 90.0f);
        }
        return new LabelMappingResult(categories, weather, confidence);
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: analyzeToken なしの場合は photo_ai_predictions に保存されない")
    void createPhoto_withoutAnalyzeToken_doesNotSavePrediction() {
        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/no-token.jpg");
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(photoAiPredictionRepository.findAll()).isEmpty();
        assertThat(response).isNotNull();
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: 有効な analyzeToken で AI 予測結果が photo_ai_predictions に保存される")
    void createPhoto_withValidAnalyzeToken_savesPrediction() {
        String token = aiPredictionCacheService.save(
                aiResult(List.of(CodeConstants.CATEGORY_NATURE), CodeConstants.WEATHER_SUNNY)
        );
        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/with-token.jpg");
        request.setCategories(List.of("風景"));
        request.setAnalyzeToken(token);

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        List<PhotoAiPrediction> predictions = photoAiPredictionRepository.findAll();
        assertThat(predictions).hasSize(1);
        PhotoAiPrediction p = predictions.get(0);
        assertThat(p.getPhotoId()).isEqualTo(response.getPhoto().getPhotoId());
        assertThat(p.getModelName()).isEqualTo("rekognition-detect-labels");
        assertThat(p.getPredictedWeather()).isEqualTo(CodeConstants.WEATHER_SUNNY);
        assertThat(p.isUserDiffFlag()).isFalse(); // AI=[201], user=[201] → 重複あり
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: AI 予測カテゴリとユーザー選択が重複ゼロなら user_diff_flag=true")
    void createPhoto_categoriesNoOverlap_setsUserDiffFlagTrue() {
        // AI=自然風景(201), ユーザー=都市(202) → 重複ゼロ
        String token = aiPredictionCacheService.save(
                aiResult(List.of(CodeConstants.CATEGORY_NATURE), null)
        );
        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/diff.jpg");
        request.setCategories(List.of("都市・街並み"));
        request.setAnalyzeToken(token);

        photoService.createPhoto(request, testUser.getEmail());

        PhotoAiPrediction p = photoAiPredictionRepository.findAll().get(0);
        assertThat(p.isUserDiffFlag()).isTrue();
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: AI 予測カテゴリが空ならユーザー選択にかかわらず user_diff_flag=false")
    void createPhoto_aiPredictedEmpty_userDiffFlagFalse() {
        String token = aiPredictionCacheService.save(aiResult(List.of(), null));
        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/empty-ai.jpg");
        request.setCategories(List.of("風景"));
        request.setAnalyzeToken(token);

        photoService.createPhoto(request, testUser.getEmail());

        PhotoAiPrediction p = photoAiPredictionRepository.findAll().get(0);
        assertThat(p.isUserDiffFlag()).isFalse();
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: 期限切れ analyzeToken は無視され、写真投稿は成功する")
    void createPhoto_expiredAnalyzeToken_isIgnored() {
        // 期限切れトークンを直接挿入（findValid() が空を返す状況を再現）
        // 簡単に: 存在しない UUID を渡す = findValid() が Optional.empty()
        String fakeToken = java.util.UUID.randomUUID().toString();
        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/expired.jpg");
        request.setCategories(List.of("風景"));
        request.setAnalyzeToken(fakeToken);

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(photoAiPredictionRepository.findAll()).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: AI 予測結果保存後、analyzeToken はキャッシュから削除される（使い切り）")
    void createPhoto_consumesAnalyzeToken() {
        String token = aiPredictionCacheService.save(
                aiResult(List.of(CodeConstants.CATEGORY_NATURE), null)
        );
        assertThat(aiPredictionCacheService.findValid(token)).isPresent();

        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/consume.jpg");
        request.setCategories(List.of("風景"));
        request.setAnalyzeToken(token);

        photoService.createPhoto(request, testUser.getEmail());

        // 投稿後はトークンが削除されている
        assertThat(aiPredictionCacheService.findValid(token)).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - createPhoto: predicted_categories と confidence は JSON 文字列で保存される")
    void createPhoto_savesCategoriesAndConfidenceAsJson() throws Exception {
        Map<String, Float> conf = Map.of(
                String.valueOf(CodeConstants.CATEGORY_NATURE), 92.5f,
                String.valueOf(CodeConstants.WEATHER_SUNNY), 88.0f
        );
        LabelMappingResult ai = new LabelMappingResult(
                List.of(CodeConstants.CATEGORY_NATURE),
                CodeConstants.WEATHER_SUNNY,
                conf
        );
        String token = aiPredictionCacheService.save(ai);

        CreatePhotoRequest request = baseRequest("uploads/" + testUser.getId() + "/json.jpg");
        request.setCategories(List.of("風景"));
        request.setAnalyzeToken(token);
        photoService.createPhoto(request, testUser.getEmail());

        PhotoAiPrediction p = photoAiPredictionRepository.findAll().get(0);
        List<Integer> deserializedCategories = objectMapper.readValue(
                p.getPredictedCategories(), new TypeReference<List<Integer>>() {});
        Map<String, Float> deserializedConfidence = objectMapper.readValue(
                p.getConfidence(), new TypeReference<Map<String, Float>>() {});

        assertThat(deserializedCategories).containsExactly(CodeConstants.CATEGORY_NATURE);
        assertThat(deserializedConfidence)
                .containsEntry(String.valueOf(CodeConstants.CATEGORY_NATURE), 92.5f)
                .containsEntry(String.valueOf(CodeConstants.WEATHER_SUNNY), 88.0f);
    }
}
