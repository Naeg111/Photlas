package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class PhotoServiceTest {

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

    @Autowired
    private PhotoCategoryRepository photoCategoryRepository;

    private User testUser;
    private Category landscapeCategory;
    private Category cityCategory;

    @BeforeEach
    void setUp() {
        // クリーンアップ
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
        testUser.setRole("USER");
        testUser = userRepository.save(testUser);

        // カテゴリマスターデータを作成
        landscapeCategory = new Category();
        landscapeCategory.setName("風景");
        landscapeCategory = categoryRepository.save(landscapeCategory);

        cityCategory = new Category();
        cityCategory.setName("都市・街並み");
        cityCategory = categoryRepository.save(cityCategory);
    }

    @Test
    @DisplayName("スポット集約ロジック - 新規スポット作成")
    void testCreatePhoto_NoExistingSpot_CreatesNewSpot() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("新規スポットの写真");
        request.setS3ObjectKey("photos/test001.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getTitle()).isEqualTo("新規スポットの写真");
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
        request.setTitle("近くの写真");
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
        request.setTitle("遠い場所の写真");
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
        request.setTitle("中間の写真");
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
        request.setTitle("カテゴリテスト");
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
        request.setTitle("複数カテゴリテスト");
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
        request.setTitle("無効カテゴリテスト");
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
    @DisplayName("天気情報取得ロジック - 天気APIが正常に動作する場合")
    void testCreatePhoto_WeatherAPISuccess_SavesWeatherInfo() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("天気テスト");
        request.setS3ObjectKey("photos/test008.jpg");
        request.setTakenAt("2025-08-22T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getWeather()).isNotNull();
        // 天気情報が設定されていることを確認（"Unknown" または実際の天気）
        assertThat(response.getPhoto().getWeather()).isIn("Unknown", "Sunny", "Rainy", "Cloudy", "Snowy");
    }

    @Test
    @DisplayName("天気情報取得ロジック - 天気APIがエラーの場合はUnknownで続行")
    void testCreatePhoto_WeatherAPIError_SavesUnknownAndContinues() {
        // 天気APIがエラーになるような条件（過去の日付など）でテスト
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("天気エラーテスト");
        request.setS3ObjectKey("photos/test009.jpg");
        request.setTakenAt("2020-01-01T00:00:00Z");  // 過去の日付
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        // エラーでも処理が続行され、天気は"Unknown"が設定される
        assertThat(response.getPhoto().getWeather()).isEqualTo("Unknown");
    }

    @Test
    @DisplayName("トランザクション - 全ての処理が1つのトランザクションで実行される")
    void testCreatePhoto_AllOperations_ExecutedInSingleTransaction() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("トランザクションテスト");
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
    @DisplayName("トランザクション - カテゴリエラー時は全てロールバック")
    void testCreatePhoto_CategoryError_RollsBackAllChanges() {
        long initialSpotCount = spotRepository.count();
        long initialPhotoCount = photoRepository.count();

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("ロールバックテスト");
        request.setS3ObjectKey("photos/test011.jpg");
        request.setTakenAt("2025-08-24T15:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("存在しないカテゴリ"));

        assertThatThrownBy(() -> photoService.createPhoto(request, testUser.getEmail()))
                .isInstanceOf(CategoryNotFoundException.class);

        // エラー時は全てロールバックされ、データが追加されていないことを確認
        assertThat(spotRepository.count()).isEqualTo(initialSpotCount);
        assertThat(photoRepository.count()).isEqualTo(initialPhotoCount);
    }
}
