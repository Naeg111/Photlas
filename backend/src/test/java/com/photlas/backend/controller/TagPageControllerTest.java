package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.TagCategory;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#135 Phase 13 + Issue#136 Phase 5: {@code GET /tags/{slug}} Thymeleaf ランディングページのテスト。
 *
 * <p>SEO ターゲットの SSR ページ。Thymeleaf テンプレートが正しくレンダリングされ、
 * 404 や言語リダイレクト、hreflang 出力等が要件通りに動くことを検証する。</p>
 *
 * <p>Issue#136 Phase 5: page / lang 正規化と 1 ホップ 301 のエッジケース検証を追加。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TagPageControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private UserRepository userRepository;

    private Tag cherry;
    private User activeUser;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();

        cherry = new Tag();
        cherry.setRekognitionLabel("Cherry Blossom");
        cherry.setSlug("cherry-blossom");
        cherry.setDisplayNameJa("桜");
        cherry.setDisplayNameEn("Cherry Blossom");
        cherry.setDisplayNameZh("樱花");
        cherry.setDisplayNameKo("벚꽃");
        cherry.setDisplayNameEs("Flor de cerezo");
        cherry.setIsActive(true);
        cherry.setSortOrder(10);
        cherry = tagRepository.saveAndFlush(cherry);

        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        activeUser = new User();
        activeUser.setUsername("u" + shortId);
        activeUser.setEmail("u" + shortId + "@example.com");
        activeUser.setPasswordHash("dummy");
        activeUser.setRole(CodeConstants.ROLE_USER);
        activeUser = userRepository.save(activeUser);
    }

    private Photo createPublishedPhoto() {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(activeUser.getId());
        photo.setS3ObjectKey("tagpg/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.saveAndFlush(photo);
    }

    private void link(Photo p, Tag t) {
        PhotoTag pt = new PhotoTag(p.getPhotoId(), t.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt);
    }

    // ===== Issue#135 Phase 13: 既存テスト =====

    @Test
    @DisplayName("Issue#135 - GET /tags/cherry-blossom?lang=ja: 200 と日本語タイトルを含む HTML")
    void getTagPage_ja_returnsHtmlWithJapaneseTitle() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("桜")));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/cherry-blossom?lang=en: 英語表示名で返す")
    void getTagPage_en_returnsHtmlWithEnglishTitle() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Cherry Blossom")));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}: lang パラメータ未指定なら ?lang=en へ 301 リダイレクト")
    void getTagPage_noLang_redirectsToEnglish() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/nonexistent-slug?lang=ja: 404")
    void getTagPage_nonexistentSlug_returns404() throws Exception {
        mockMvc.perform(get("/tags/nonexistent-slug").param("lang", "ja"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}: is_active=FALSE のキーワードは 404")
    void getTagPage_inactiveTag_returns404() throws Exception {
        cherry.setIsActive(false);
        tagRepository.saveAndFlush(cherry);

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}?lang=ja: hreflang メタタグが 5 言語分含まれる")
    void getTagPage_includesHreflangMetaTags() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("hreflang=\"ja\"")))
                .andExpect(content().string(containsString("hreflang=\"en\"")))
                .andExpect(content().string(containsString("hreflang=\"zh\"")))
                .andExpect(content().string(containsString("hreflang=\"ko\"")))
                .andExpect(content().string(containsString("hreflang=\"es\"")))
                .andExpect(content().string(containsString("hreflang=\"x-default\"")));
    }

    // ===== Issue#136 Phase 5: page / lang 正規化と 1 ホップ 301 =====

    @Test
    @DisplayName("Issue#136 - ?page=1 明示 → ?page 無し URL に 301")
    void pageEqualsOne_redirectsToNoPageUrl() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "1"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?page=0 → ?page 無し URL に 301")
    void pageEqualsZero_redirectsToNoPageUrl() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "0"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?page=-1 → ?page 無し URL に 301")
    void pageNegative_redirectsToNoPageUrl() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "-1"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?page=abc 非数字 → 400 ではなく ?page 無し URL に 301")
    void pageNonNumeric_redirectsToNoPageUrl() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "abc"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - 0 件タグで ?page=99999 → ?page 無し URL に 301")
    void pageOutOfRangeForEmptyTag_redirectsToNoPageUrl() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "99999"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?page=99999 (totalPages=2) → 最終ページに 301")
    void pageOutOfRangeForMultiPageTag_redirectsToLastPage() throws Exception {
        // PAGE_SIZE=48 → 49 枚で 2 ページ
        for (int i = 0; i < 49; i++) {
            link(createPublishedPhoto(), cherry);
        }

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en").param("page", "99999"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en&page=2"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=zh-TW → ?lang=zh に 301")
    void langZhTW_redirectsToZh() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "zh-TW"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=zh"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=zh-CN → ?lang=zh に 301")
    void langZhCN_redirectsToZh() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "zh-CN"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=zh"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=en-US → ?lang=en に 301")
    void langEnUS_redirectsToEn() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en-US"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=fr 未サポート → ?lang=en にフォールバック 301")
    void langUnsupported_redirectsToEnglish() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "fr"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=zh-TW&page=99999 (0 件タグ) → 1 ホップで ?lang=zh に")
    void langAndPageBothInvalid_redirectsInOneHop() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "zh-TW").param("page", "99999"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=zh"));
    }

    @Test
    @DisplayName("Issue#136 - ?lang=en-US&page=1 → 1 ホップで ?lang=en に（page=1 も無印化）")
    void langNonCanonicalWithPageOne_redirectsInOneHop() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en-US").param("page", "1"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrl("/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#136 - 200 path: photos と pagination が Model に追加される")
    void renders200WithPhotosAndPagination() throws Exception {
        for (int i = 0; i < 3; i++) {
            link(createPublishedPhoto(), cherry);
        }

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(model().attributeExists("photos"))
                .andExpect(model().attribute("photos", hasSize(3)))
                .andExpect(model().attributeExists("pagination"));
    }

    // ===== Issue#136 Phase 6: title / description の MessageSource 多言語化 (Q15) =====

    @Test
    @DisplayName("Issue#136 - Phase6: ja の <title> が『桜 - 1 ページ目 - Photlas』")
    void titleJa_pageOne() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>桜 - 1 ページ目 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: en の <title> が『Cherry Blossom - Page 1 - Photlas』")
    void titleEn_pageOne() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>Cherry Blossom - Page 1 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: zh の <title> が『樱花 - 第 1 页 - Photlas』")
    void titleZh_pageOne() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "zh"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>樱花 - 第 1 页 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: ko の <title> が『벚꽃 - 1 페이지 - Photlas』")
    void titleKo_pageOne() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ko"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>벚꽃 - 1 페이지 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: es の <title> が『Flor de cerezo - Página 1 - Photlas』")
    void titleEs_pageOne() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "es"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>Flor de cerezo - Página 1 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: 2 ページ目で <title> が『桜 - 2 ページ目 - Photlas』")
    void titleJa_pageTwo() throws Exception {
        for (int i = 0; i < 49; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja").param("page", "2"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>桜 - 2 ページ目 - Photlas</title>")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: en の <meta description> がページ番号と件数を含む")
    void descriptionEn_includesPageAndCount() throws Exception {
        for (int i = 0; i < 3; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("name=\"description\"")))
                .andExpect(content().string(containsString("Cherry Blossom")))
                .andExpect(content().string(containsString("3 photos")))
                .andExpect(content().string(containsString("Page 1")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: ja の <meta description> がページ番号と件数を含む")
    void descriptionJa_includesPageAndCount() throws Exception {
        for (int i = 0; i < 3; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("name=\"description\"")))
                .andExpect(content().string(containsString("3 枚")))
                .andExpect(content().string(containsString("1 ページ目")));
    }

    @Test
    @DisplayName("Issue#136 - Phase6: og:title と og:description が <title>/<meta description> と同じ Model 属性を使う")
    void ogTitleAndDescriptionMatch() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // og:title content が title と一致
                .andExpect(content().string(containsString(
                        "property=\"og:title\" content=\"桜 - 1 ページ目 - Photlas\"")))
                // og:description content にも 1 ページ目 表記が含まれる（description と一致）
                .andExpect(content().string(containsString("property=\"og:description\"")))
                .andExpect(model().attributeExists("title"))
                .andExpect(model().attributeExists("description"));
    }

    // ===== Issue#136 Phase 7: body i18n + 省略付きページネーション =====

    @Test
    @DisplayName("Issue#136 - Phase7: ja の本文に『3 枚』が表示される")
    void bodyUnitPhotos_ja() throws Exception {
        for (int i = 0; i < 3; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("3 枚")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: en の本文に『3 photos』が表示される")
    void bodyUnitPhotos_en() throws Exception {
        for (int i = 0; i < 3; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("3 photos")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: ja の 0 件案内文が日本語表記")
    void emptyMessage_ja() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("まだこのキーワードの写真がありません")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: en の 0 件案内文が英語表記")
    void emptyMessage_en() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("No photos for this keyword yet")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: ko の 0 件案内文が韓国語表記")
    void emptyMessage_ko() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ko"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("이 키워드의 사진이 아직 없습니다")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: 1 ページのみのときページネーションが描画されない")
    void noPagination_singlePage() throws Exception {
        for (int i = 0; i < 10; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // ?page=2 等への遷移リンクは出ない
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("?lang=ja&page=2"))));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: 2 ページ目への next link href が含まれる")
    void paginationNextLink_pageOne() throws Exception {
        // PAGE_SIZE=48 → 49 枚で 2 ページ
        for (int i = 0; i < 49; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // 「次へ」リンクの href が ?lang=ja&page=2
                .andExpect(content().string(containsString("?lang=ja&amp;page=2")))
                // 「次へ」テキスト
                .andExpect(content().string(containsString("次へ")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: 2 ページ目から 1 ページ目への prev link が含まれる（page=1 は無印）")
    void paginationPrevLink_pageTwo() throws Exception {
        for (int i = 0; i < 49; i++) {
            link(createPublishedPhoto(), cherry);
        }
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja").param("page", "2"))
                .andExpect(status().isOk())
                // 「前へ」テキスト
                .andExpect(content().string(containsString("前へ")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: footer タグライン ja『Photlas - 撮影スポット共有』")
    void footerTagline_ja() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Photlas - 撮影スポット共有")));
    }

    @Test
    @DisplayName("Issue#136 - Phase7: footer タグライン en『Photlas - Photo spot sharing』")
    void footerTagline_en() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Photlas - Photo spot sharing")));
    }

    // ===== Issue#136 Phase 9: 0 件時の関連キーワード描画 =====

    /** Phase 9 用: cherry に同カテゴリの仲間 (tulip, rose) を作る。 */
    private void seedRelatedTags() {
        tagCategoryRepository.saveAndFlush(new TagCategory(cherry.getId(), CodeConstants.CATEGORY_PLANTS));

        Tag tulip = new Tag();
        tulip.setRekognitionLabel("Tulip");
        tulip.setSlug("tulip");
        tulip.setDisplayNameJa("チューリップ");
        tulip.setDisplayNameEn("Tulip");
        tulip.setIsActive(true);
        tulip.setSortOrder(10);
        tulip = tagRepository.saveAndFlush(tulip);
        tagCategoryRepository.saveAndFlush(new TagCategory(tulip.getId(), CodeConstants.CATEGORY_PLANTS));

        Tag rose = new Tag();
        rose.setRekognitionLabel("Rose");
        rose.setSlug("rose");
        rose.setDisplayNameJa("薔薇");
        rose.setDisplayNameEn("Rose");
        rose.setIsActive(true);
        rose.setSortOrder(20);
        rose = tagRepository.saveAndFlush(rose);
        tagCategoryRepository.saveAndFlush(new TagCategory(rose.getId(), CodeConstants.CATEGORY_PLANTS));
    }

    @Test
    @DisplayName("Issue#136 - Phase9: 0 件タグで ja の関連キーワードラベルとリンクが描画される")
    void relatedKeywords_renderedWhenEmpty_ja() throws Exception {
        seedRelatedTags();

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // ラベル表示
                .andExpect(content().string(containsString("関連するキーワード")))
                // 関連 tag の表示名
                .andExpect(content().string(containsString("チューリップ")))
                .andExpect(content().string(containsString("薔薇")))
                // 関連 tag の URL (lang は引き継ぐ)
                .andExpect(content().string(containsString("/tags/tulip?lang=ja")))
                .andExpect(content().string(containsString("/tags/rose?lang=ja")));
    }

    @Test
    @DisplayName("Issue#136 - Phase9: 0 件タグで en の関連キーワードラベルが英語")
    void relatedKeywords_renderedWhenEmpty_en() throws Exception {
        seedRelatedTags();

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Related keywords")))
                .andExpect(content().string(containsString("Tulip")))
                // en では英語の URL
                .andExpect(content().string(containsString("/tags/tulip?lang=en")));
    }

    @Test
    @DisplayName("Issue#136 - Phase9: 写真ありのときは関連キーワードセクションを描画しない")
    void relatedKeywords_notRenderedWhenNotEmpty() throws Exception {
        seedRelatedTags();
        // 写真 1 枚以上付与
        link(createPublishedPhoto(), cherry);

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // 関連ラベルは出ない
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("関連するキーワード"))));
    }

    @Test
    @DisplayName("Issue#136 - Phase9: 関連 0 件 (孤立 tag) では関連セクションが描画されない")
    void relatedKeywords_notRenderedWhenNoPeers() throws Exception {
        // cherry にはカテゴリ・仲間が無い
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                // 0 件案内は出る
                .andExpect(content().string(containsString("まだこのキーワードの写真がありません")))
                // 関連ラベルは出ない
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("関連するキーワード"))));
    }

    @Test
    @DisplayName("Issue#136 - Phase9: relatedTags が Model に常に存在する（0 件時は空リスト）")
    void relatedTags_alwaysPresentInModel() throws Exception {
        seedRelatedTags();
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(model().attributeExists("relatedTags"))
                .andExpect(model().attribute("relatedTags", hasSize(2)));
    }
}
