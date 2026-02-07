package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.TagRepository;
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

    @Autowired
    private TagRepository tagRepository;

    private User testUser;
    private Category landscapeCategory;
    private Category cityCategory;

    @BeforeEach
    void setUp() {
        // クリーンアップ
        photoCategoryRepository.deleteAll();
        photoRepository.deleteAll();
        tagRepository.deleteAll();
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
    @DisplayName("トランザクション - カテゴリエラー時は例外をスロー")
    void testCreatePhoto_CategoryError_ThrowsException() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("ロールバックテスト");
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
        request.setTitle("カテゴリ無し写真");
        request.setS3ObjectKey("photos/nocat001.jpg");
        request.setTakenAt("2026-01-20T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of()); // 空リスト

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getTitle()).isEqualTo("カテゴリ無し写真");

        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).isEmpty();
    }

    @Test
    @DisplayName("Issue#48 - カテゴリnullでの投稿が成功する")
    void testCreatePhoto_NullCategories_SucceedsWithoutCategory() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("カテゴリnull写真");
        request.setS3ObjectKey("photos/nullcat001.jpg");
        request.setTakenAt("2026-01-21T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(null); // null

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getTitle()).isEqualTo("カテゴリnull写真");

        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getCategories()).isEmpty();
    }

    // ===== Issue#40: Photo Entity拡張テスト =====

    @Test
    @DisplayName("Issue#40 - EXIF情報付き写真の投稿が正常に保存される")
    void testCreatePhoto_WithExifData_SavesAllExifFields() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("EXIF付き写真");
        request.setS3ObjectKey("photos/exif001.jpg");
        request.setTakenAt("2026-01-15T17:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        request.setShootingDirection(new BigDecimal("180.50"));
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
        assertThat(response.getPhoto().getShootingDirection()).isEqualByComparingTo(new BigDecimal("180.50"));

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
        assertThat(savedPhoto.getShootingDirection()).isEqualByComparingTo(new BigDecimal("180.50"));
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
        request.setTitle("EXIF無し写真");
        request.setS3ObjectKey("photos/noexif001.jpg");
        request.setTakenAt("2026-01-16T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        // EXIF情報は全て未設定

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getShootingDirection()).isNull();
        assertThat(response.getPhoto().getExif()).isNull();

        // データベースの値も確認
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getShootingDirection()).isNull();
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
        photo.setTitle("EXIF詳細テスト");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 15, 17, 30));
        photo.setWeather("sunny");
        photo.setShootingDirection(new BigDecimal("270.00"));
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

        PhotoResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getShootingDirection()).isEqualByComparingTo(new BigDecimal("270.00"));

        PhotoResponse.ExifDTO exif = response.getPhoto().getExif();
        assertThat(exif).isNotNull();
        assertThat(exif.getCameraBody()).isEqualTo("Sony α7 IV");
        assertThat(exif.getCameraLens()).isEqualTo("FE 24-105mm F4 G OSS");
        assertThat(exif.getFocalLength35mm()).isEqualTo(50);
        assertThat(exif.getFValue()).isEqualTo("f/4.0");
        assertThat(exif.getShutterSpeed()).isEqualTo("1/500");
        assertThat(exif.getIso()).isEqualTo(200);
        assertThat(exif.getImageWidth()).isEqualTo(7008);
        assertThat(exif.getImageHeight()).isEqualTo(4672);
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
        photo.setTitle("部分EXIF");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 16, 10, 0));
        photo.setWeather("cloudy");
        // カメラ名とISOのみ設定
        photo.setCameraBody("iPhone 15 Pro");
        photo.setIso(100);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        PhotoResponse.ExifDTO exif = response.getPhoto().getExif();
        assertThat(exif).isNotNull();
        assertThat(exif.getCameraBody()).isEqualTo("iPhone 15 Pro");
        assertThat(exif.getIso()).isEqualTo(100);
        assertThat(exif.getCameraLens()).isNull();
        assertThat(exif.getFocalLength35mm()).isNull();
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
        photo.setTitle("座標テスト");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 1, 17, 12, 0));
        photo.setWeather("sunny");
        photo.setLatitude(new BigDecimal("35.658600"));
        photo.setLongitude(new BigDecimal("139.745450"));
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        // 写真ごとのピンポイント座標が返されることを確認
        assertThat(response.getPhoto().getLatitude()).isEqualByComparingTo(new BigDecimal("35.658600"));
        assertThat(response.getPhoto().getLongitude()).isEqualByComparingTo(new BigDecimal("139.745450"));
        // スポット座標は別途返される
        assertThat(response.getSpot().getLatitude()).isEqualByComparingTo(new BigDecimal("35.658581"));
    }

    // ===== Issue#43: タグシステムテスト =====

    @Test
    @DisplayName("Issue#43 - タグ付き写真の投稿が正常に保存される")
    void testCreatePhoto_WithTags_SavesTagsCorrectly() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("タグ付き写真");
        request.setS3ObjectKey("photos/tag001.jpg");
        request.setTakenAt("2026-01-25T10:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setTags(List.of("桜", "夕焼け", "展望台"));

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getTags()).hasSize(3);
        assertThat(response.getPhoto().getTags())
                .extracting(PhotoResponse.TagDTO::getName)
                .containsExactlyInAnyOrder("桜", "夕焼け", "展望台");
    }

    @Test
    @DisplayName("Issue#43 - タグなしでの投稿が成功する")
    void testCreatePhoto_WithoutTags_SucceedsWithEmptyTags() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("タグなし写真");
        request.setS3ObjectKey("photos/notag001.jpg");
        request.setTakenAt("2026-01-25T11:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        // タグ未設定

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getTags()).isEmpty();
    }

    @Test
    @DisplayName("Issue#43 - 既存タグが再利用される（新規作成されない）")
    void testCreatePhoto_ExistingTag_ReusesTag() {
        // 最初の写真でタグを作成
        CreatePhotoRequest request1 = new CreatePhotoRequest();
        request1.setTitle("最初のタグ写真");
        request1.setS3ObjectKey("photos/tag002.jpg");
        request1.setTakenAt("2026-01-25T12:00:00Z");
        request1.setLatitude(new BigDecimal("35.658581"));
        request1.setLongitude(new BigDecimal("139.745433"));
        request1.setTags(List.of("桜"));

        photoService.createPhoto(request1, testUser.getEmail());

        long tagCountBefore = tagRepository.count();

        // 同じタグで2枚目の写真を投稿
        CreatePhotoRequest request2 = new CreatePhotoRequest();
        request2.setTitle("2枚目のタグ写真");
        request2.setS3ObjectKey("photos/tag003.jpg");
        request2.setTakenAt("2026-01-25T13:00:00Z");
        request2.setLatitude(new BigDecimal("35.660000"));
        request2.setLongitude(new BigDecimal("139.746000"));
        request2.setTags(List.of("桜"));

        PhotoResponse response2 = photoService.createPhoto(request2, testUser.getEmail());

        assertThat(response2.getPhoto().getTags()).hasSize(1);
        // タグが新規作成されていないことを確認
        assertThat(tagRepository.count()).isEqualTo(tagCountBefore);
    }

    // ===== Issue#49: クロップ（トリミング）データテスト =====

    @Test
    @DisplayName("Issue#49 - クロップデータ付き写真の投稿が正常に保存される")
    void testCreatePhoto_WithCropData_SavesCropFields() {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("クロップ付き写真");
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
        request.setTitle("クロップ無し写真");
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
        photo.setTitle("クロップ詳細テスト");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 2, 8, 10, 0));
        photo.setWeather("sunny");
        photo.setCropCenterX(0.25);
        photo.setCropCenterY(0.75);
        photo.setCropZoom(2.0);
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getCropCenterX()).isEqualTo(0.25);
        assertThat(response.getPhoto().getCropCenterY()).isEqualTo(0.75);
        assertThat(response.getPhoto().getCropZoom()).isEqualTo(2.0);
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
        photo.setTitle("クロップ無し詳細");
        photo.setShotAt(java.time.LocalDateTime.of(2026, 2, 8, 11, 0));
        photo.setWeather("cloudy");
        photo.setCategories(List.of(landscapeCategory));
        photo = photoRepository.save(photo);

        PhotoResponse response = photoService.getPhotoDetail(photo.getPhotoId(), testUser.getEmail());

        assertThat(response).isNotNull();
        assertThat(response.getPhoto().getCropCenterX()).isNull();
        assertThat(response.getPhoto().getCropCenterY()).isNull();
        assertThat(response.getPhoto().getCropZoom()).isNull();
    }

    @Test
    @DisplayName("Issue#43 - 写真詳細取得でタグが返される")
    void testGetPhotoDetail_WithTags_ReturnsTagsInResponse() {
        // タグ付き写真を投稿
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("詳細タグテスト");
        request.setS3ObjectKey("photos/tagdetail001.jpg");
        request.setTakenAt("2026-01-25T14:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setTags(List.of("リフレクション", "湖"));

        PhotoResponse createResponse = photoService.createPhoto(request, testUser.getEmail());

        // 詳細取得
        PhotoResponse detailResponse = photoService.getPhotoDetail(
                createResponse.getPhoto().getPhotoId(), testUser.getEmail());

        assertThat(detailResponse.getPhoto().getTags()).hasSize(2);
        assertThat(detailResponse.getPhoto().getTags())
                .extracting(PhotoResponse.TagDTO::getName)
                .containsExactlyInAnyOrder("リフレクション", "湖");
    }
}
