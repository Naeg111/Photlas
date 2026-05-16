package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.CodeConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#119 - {@link RekognitionLabelMapper} の単体テスト。
 *
 * <p>AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードへ
 * マッピングするロジックを検証する。マッピングルール詳細は Issue#119 の 4.1 / 4.2 を参照。</p>
 *
 * <p>本テストは Spring を起動せず、純粋なロジックとして高速に実行する。</p>
 */
class RekognitionLabelMapperTest {

    private RekognitionLabelMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new RekognitionLabelMapper();
    }

    private Label label(String name, float confidence) {
        return Label.builder().name(name).confidence(confidence).build();
    }

    // ========== カテゴリマッピング ==========

    @Test
    @DisplayName("Issue#119 - 自然風景: Mountain ラベル80%で 201 が返る")
    void natureFromMountain() {
        LabelMappingResult result = mapper.map(List.of(label("Mountain", 80f)));

        assertThat(result.categories()).containsExactly(CodeConstants.CATEGORY_NATURE);
    }

    @Test
    @DisplayName("Issue#119 - 自然風景: Sea / River / Forest / Landscape も 201 を返す")
    void natureFromOtherLabels() {
        assertThat(mapper.map(List.of(label("Sea", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_NATURE);
        assertThat(mapper.map(List.of(label("River", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_NATURE);
        assertThat(mapper.map(List.of(label("Forest", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_NATURE);
        assertThat(mapper.map(List.of(label("Landscape", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_NATURE);
    }

    @Test
    @DisplayName("Issue#119 - 街並み: City / Skyline / Urban / Cityscape は 202 を返す")
    void cityscapeFromCityLabels() {
        assertThat(mapper.map(List.of(label("City", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CITYSCAPE);
        assertThat(mapper.map(List.of(label("Skyline", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CITYSCAPE);
        assertThat(mapper.map(List.of(label("Urban", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CITYSCAPE);
        assertThat(mapper.map(List.of(label("Cityscape", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CITYSCAPE);
    }

    @Test
    @DisplayName("Issue#119 - 建造物: Building / Architecture / Bridge / Tower / Skyscraper は 203 を返す")
    void architectureFromBuildingLabels() {
        assertThat(mapper.map(List.of(label("Building", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
        assertThat(mapper.map(List.of(label("Architecture", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
        assertThat(mapper.map(List.of(label("Bridge", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
        assertThat(mapper.map(List.of(label("Tower", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
        assertThat(mapper.map(List.of(label("Skyscraper", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
    }

    @Test
    @DisplayName("Issue#119 - 夜景: Night + City の組合せで 202 と 204 の両方を返す")
    void nightViewFromNightAndCity() {
        LabelMappingResult result = mapper.map(List.of(
                label("Night", 90f),
                label("City", 80f)
        ));

        assertThat(result.categories())
                .containsExactlyInAnyOrder(CodeConstants.CATEGORY_CITYSCAPE, CodeConstants.CATEGORY_NIGHT_VIEW);
    }

    @Test
    @DisplayName("Issue#119 - 夜景: Night + Building の組合せでも 204 を返す")
    void nightViewFromNightAndBuilding() {
        LabelMappingResult result = mapper.map(List.of(
                label("Night", 90f),
                label("Building", 80f)
        ));

        assertThat(result.categories())
                .containsExactlyInAnyOrder(CodeConstants.CATEGORY_ARCHITECTURE, CodeConstants.CATEGORY_NIGHT_VIEW);
    }

    @Test
    @DisplayName("Issue#119 - 夜景: Night 単独（City/Building/Architecture なし）では 204 にならない")
    void nightAloneDoesNotMapToNightView() {
        LabelMappingResult result = mapper.map(List.of(label("Night", 90f)));

        assertThat(result.categories()).doesNotContain(CodeConstants.CATEGORY_NIGHT_VIEW);
    }

    @Test
    @DisplayName("Issue#119 - グルメ: Food / Meal / Restaurant / Dish / Cuisine は 205 を返す")
    void gourmetFromFoodLabels() {
        assertThat(mapper.map(List.of(label("Food", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_GOURMET);
        assertThat(mapper.map(List.of(label("Meal", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_GOURMET);
        assertThat(mapper.map(List.of(label("Restaurant", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_GOURMET);
        assertThat(mapper.map(List.of(label("Dish", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_GOURMET);
        assertThat(mapper.map(List.of(label("Cuisine", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_GOURMET);
    }

    @Test
    @DisplayName("Issue#119 - 植物: Flower / Plant / Tree / Garden は 206 を返す")
    void plantsFromPlantLabels() {
        assertThat(mapper.map(List.of(label("Flower", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_PLANTS);
        assertThat(mapper.map(List.of(label("Plant", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_PLANTS);
        assertThat(mapper.map(List.of(label("Tree", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_PLANTS);
        assertThat(mapper.map(List.of(label("Garden", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_PLANTS);
    }

    @Test
    @DisplayName("Issue#119 - 動物: Animal / Dog / Cat / Mammal は 207 を返す")
    void animalsFromAnimalLabels() {
        assertThat(mapper.map(List.of(label("Animal", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ANIMALS);
        assertThat(mapper.map(List.of(label("Dog", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ANIMALS);
        assertThat(mapper.map(List.of(label("Cat", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ANIMALS);
        assertThat(mapper.map(List.of(label("Mammal", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_ANIMALS);
    }

    @Test
    @DisplayName("Issue#119 - 野鳥: Bird は 207 と 208 の両方を候補として返す")
    void birdMapsToBothAnimalsAndWildBirds() {
        LabelMappingResult result = mapper.map(List.of(label("Bird", 80f)));

        assertThat(result.categories())
                .containsExactlyInAnyOrder(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS);
    }

    @Test
    @DisplayName("Issue#119 - 自動車: Car / Vehicle / Automobile は 209 を返す")
    void carsFromCarLabels() {
        assertThat(mapper.map(List.of(label("Car", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CARS);
        assertThat(mapper.map(List.of(label("Vehicle", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CARS);
        assertThat(mapper.map(List.of(label("Automobile", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_CARS);
    }

    @Test
    @DisplayName("Issue#119 - バイク: Motorcycle は 210 を返す")
    void motorcyclesFromMotorcycleLabel() {
        assertThat(mapper.map(List.of(label("Motorcycle", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_MOTORCYCLES);
    }

    @Test
    @DisplayName("Issue#119 - 鉄道: Train / Railway / Locomotive / Subway は 211 を返す")
    void railwaysFromTrainLabels() {
        assertThat(mapper.map(List.of(label("Train", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_RAILWAYS);
        assertThat(mapper.map(List.of(label("Railway", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_RAILWAYS);
        assertThat(mapper.map(List.of(label("Locomotive", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_RAILWAYS);
        assertThat(mapper.map(List.of(label("Subway", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_RAILWAYS);
    }

    @Test
    @DisplayName("Issue#119 - 飛行機: Aircraft / Airplane / Helicopter は 212 を返す")
    void aircraftFromAircraftLabels() {
        assertThat(mapper.map(List.of(label("Aircraft", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_AIRCRAFT);
        assertThat(mapper.map(List.of(label("Airplane", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_AIRCRAFT);
        assertThat(mapper.map(List.of(label("Helicopter", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_AIRCRAFT);
    }

    @Test
    @DisplayName("Issue#119 - 星空: Star / Night Sky / Milky Way は 213 を返す")
    void starrySkyFromStarLabels() {
        assertThat(mapper.map(List.of(label("Star", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_STARRY_SKY);
        assertThat(mapper.map(List.of(label("Night Sky", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_STARRY_SKY);
        assertThat(mapper.map(List.of(label("Milky Way", 80f))).categories())
                .containsExactly(CodeConstants.CATEGORY_STARRY_SKY);
    }

    // ========== 信頼度閾値 ==========

    @Test
    @DisplayName("Issue#119 - 信頼度80%未満のラベルはマッピングから除外される")
    void belowThresholdLabelsAreExcluded() {
        LabelMappingResult result = mapper.map(List.of(label("Mountain", 79f)));

        assertThat(result.categories()).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - 信頼度80%ちょうどのラベルは含める（境界値）")
    void exactlyThresholdLabelIsIncluded() {
        LabelMappingResult result = mapper.map(List.of(label("Mountain", 80f)));

        assertThat(result.categories()).containsExactly(CodeConstants.CATEGORY_NATURE);
    }

    // ========== 複数・重複 ==========

    @Test
    @DisplayName("Issue#119 - 複数カテゴリのラベル: それぞれ別カテゴリで含める")
    void multipleDifferentCategoriesAreReturned() {
        LabelMappingResult result = mapper.map(List.of(
                label("Mountain", 90f),
                label("Food", 80f)
        ));

        assertThat(result.categories())
                .containsExactlyInAnyOrder(CodeConstants.CATEGORY_NATURE, CodeConstants.CATEGORY_GOURMET);
    }

    @Test
    @DisplayName("Issue#119 - 同じカテゴリに該当する複数ラベル: 重複なく1回だけ含める")
    void duplicateCategoryIsDeduplicated() {
        LabelMappingResult result = mapper.map(List.of(
                label("Dog", 80f),
                label("Cat", 90f)
        ));

        assertThat(result.categories()).containsExactly(CodeConstants.CATEGORY_ANIMALS);
    }

    // ========== 天候マッピング ==========

    @Test
    @DisplayName("Issue#119 - 天候: Blue Sky / Sunshine / Clear は 401 を返す")
    void sunnyFromBlueSkyLabels() {
        assertThat(mapper.map(List.of(label("Blue Sky", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_SUNNY);
        assertThat(mapper.map(List.of(label("Sunshine", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_SUNNY);
        assertThat(mapper.map(List.of(label("Clear", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_SUNNY);
    }

    @Test
    @DisplayName("Issue#119 - 天候: Cloud / Overcast は 402 を返す")
    void cloudyFromCloudLabels() {
        assertThat(mapper.map(List.of(label("Cloud", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_CLOUDY);
        assertThat(mapper.map(List.of(label("Overcast", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_CLOUDY);
    }

    @Test
    @DisplayName("Issue#119 - 天候: Rain / Wet は 403 を返す")
    void rainFromRainLabels() {
        assertThat(mapper.map(List.of(label("Rain", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_RAIN);
        assertThat(mapper.map(List.of(label("Wet", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_RAIN);
    }

    @Test
    @DisplayName("Issue#119 - 天候: Snow / Winter は 404 を返す")
    void snowFromSnowLabels() {
        assertThat(mapper.map(List.of(label("Snow", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_SNOW);
        assertThat(mapper.map(List.of(label("Winter", 80f))).weather())
                .isEqualTo(CodeConstants.WEATHER_SNOW);
    }

    @Test
    @DisplayName("Issue#119 - 天候複数: 信頼度が最も高いラベルが採用される")
    void weatherWithHighestConfidenceWins() {
        LabelMappingResult result = mapper.map(List.of(
                label("Blue Sky", 85f),
                label("Cloud", 75f)
        ));

        assertThat(result.weather()).isEqualTo(CodeConstants.WEATHER_SUNNY);
    }

    @Test
    @DisplayName("Issue#119 - 天候: 信頼度80%未満は採用されず null")
    void weatherBelowThresholdReturnsNull() {
        LabelMappingResult result = mapper.map(List.of(label("Blue Sky", 79f)));

        assertThat(result.weather()).isNull();
    }

    @Test
    @DisplayName("Issue#119 - 天候ラベルなし: weather は null")
    void noWeatherLabelReturnsNull() {
        LabelMappingResult result = mapper.map(List.of(label("Mountain", 80f)));

        assertThat(result.weather()).isNull();
    }

    // ========== 信頼度マップ ==========

    @Test
    @DisplayName("Issue#119 - confidence マップ: 採用されたカテゴリのキー（コード文字列）と信頼度が含まれる")
    void confidenceMapContainsCategoryEntries() {
        LabelMappingResult result = mapper.map(List.of(label("Mountain", 85.5f)));

        assertThat(result.confidence())
                .containsKey(String.valueOf(CodeConstants.CATEGORY_NATURE));
        assertThat(result.confidence().get(String.valueOf(CodeConstants.CATEGORY_NATURE)))
                .isEqualTo(85.5f);
    }

    @Test
    @DisplayName("Issue#119 - confidence マップ: 採用された天候のキーと信頼度が含まれる")
    void confidenceMapContainsWeatherEntry() {
        LabelMappingResult result = mapper.map(List.of(label("Blue Sky", 88.0f)));

        assertThat(result.confidence())
                .containsKey(String.valueOf(CodeConstants.WEATHER_SUNNY));
        assertThat(result.confidence().get(String.valueOf(CodeConstants.WEATHER_SUNNY)))
                .isEqualTo(88.0f);
    }

    // ========== 空入力 ==========

    @Test
    @DisplayName("Issue#119 - 空ラベル入力: categories は空、weather は null、confidence は空")
    void emptyLabelsReturnEmptyResult() {
        LabelMappingResult result = mapper.map(List.of());

        assertThat(result.categories()).isEmpty();
        assertThat(result.weather()).isNull();
        assertThat(result.confidence()).isEmpty();
    }

    // ========== ケース大文字小文字 ==========

    @Test
    @DisplayName("Issue#119 - ラベル名は大文字小文字を区別しない（Rekognition のレスポンス揺れ対策）")
    void labelMatchingIsCaseInsensitive() {
        LabelMappingResult result = mapper.map(List.of(label("mountain", 80f)));

        assertThat(result.categories()).containsExactly(CodeConstants.CATEGORY_NATURE);
    }

    // ========== Issue#132 辞書拡充: 各カテゴリの追加ラベル ==========

    @Test
    @DisplayName("Issue#132 - 自然風景: 拡充ラベル (Waterfall/Cliff/Beach/Valley/Lake/Coast/Pond/Glacier/Canyon/Desert/Field/Meadow/Hill) は 201 を返す")
    void natureFromExpandedLabels() {
        for (String name : List.of("Waterfall", "Cliff", "Beach", "Valley", "Lake", "Coast",
                "Pond", "Glacier", "Canyon", "Desert", "Field", "Meadow", "Hill")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は自然風景 (201) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_NATURE);
        }
    }

    @Test
    @DisplayName("Issue#132 - 街並み: 拡充ラベル (Downtown/Town/Metropolis/Neighborhood/Street) は 202 を返す")
    void cityscapeFromExpandedLabels() {
        for (String name : List.of("Downtown", "Town", "Metropolis", "Neighborhood", "Street")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は街並み (202) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_CITYSCAPE);
        }
    }

    @Test
    @DisplayName("Issue#132 - 建造物: 拡充ラベル (Castle/Temple/Shrine/Church/Tunnel/Lighthouse/Stadium/Arena) は 203 を返す")
    void architectureFromExpandedLabels() {
        for (String name : List.of("Castle", "Temple", "Shrine", "Church", "Tunnel",
                "Lighthouse", "Stadium", "Arena")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は建造物 (203) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
        }
    }

    @Test
    @DisplayName("Issue#132 - グルメ: 拡充ラベル (Bread/Cake/Coffee/Sushi/Ramen/Dessert/Beverage/Fruit/Vegetable/Pasta/Pizza/Sandwich) は 205 を返す")
    void gourmetFromExpandedLabels() {
        for (String name : List.of("Bread", "Cake", "Coffee", "Sushi", "Ramen", "Dessert",
                "Beverage", "Fruit", "Vegetable", "Pasta", "Pizza", "Sandwich")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' はグルメ (205) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_GOURMET);
        }
    }

    @Test
    @DisplayName("Issue#132 - 植物: 拡充ラベル (Leaf/Petal/Branch/Vegetation/Moss/Bush/Vineyard) は 206 を返す")
    void plantsFromExpandedLabels() {
        for (String name : List.of("Leaf", "Petal", "Branch", "Vegetation", "Moss", "Bush", "Vineyard")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は植物 (206) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_PLANTS);
        }
    }

    @Test
    @DisplayName("Issue#132 - 動物: 拡充ラベル (Wildlife/Pet/Fox/Bear/Deer/Squirrel/Rabbit/Lion/Tiger) は 207 を返す")
    void animalsFromExpandedLabels() {
        for (String name : List.of("Wildlife", "Pet", "Fox", "Bear", "Deer", "Squirrel",
                "Rabbit", "Lion", "Tiger")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は動物 (207) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_ANIMALS);
        }
    }

    @Test
    @DisplayName("Issue#132 - 野鳥: 拡充ラベル (Sparrow/Eagle/Hawk/Owl/Crow/Heron/Crane) は 207 + 208 を返す")
    void wildBirdsFromExpandedLabels() {
        for (String name : List.of("Sparrow", "Eagle", "Hawk", "Owl", "Crow", "Heron", "Crane")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は動物 (207) + 野鳥 (208) にマッピングされるべき", name)
                    .containsExactlyInAnyOrder(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS);
        }
    }

    @Test
    @DisplayName("Issue#132 - 自動車: 拡充ラベル (Sedan/Suv/Truck/Sports Car) は 209 を返す")
    void carsFromExpandedLabels() {
        for (String name : List.of("Sedan", "Suv", "Truck", "Sports Car")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は自動車 (209) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_CARS);
        }
    }

    @Test
    @DisplayName("Issue#132 - 鉄道: 拡充ラベル (Tram/Cable Car/Monorail) は 211 を返す")
    void railwaysFromExpandedLabels() {
        for (String name : List.of("Tram", "Cable Car", "Monorail")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は鉄道 (211) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_RAILWAYS);
        }
    }

    @Test
    @DisplayName("Issue#132 - 飛行機: 拡充ラベル (Jet/Airliner/Biplane) は 212 を返す")
    void aircraftFromExpandedLabels() {
        for (String name : List.of("Jet", "Airliner", "Biplane")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は飛行機 (212) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_AIRCRAFT);
        }
    }

    @Test
    @DisplayName("Issue#132 - 星空: 拡充ラベル (Galaxy/Constellation/Nebula/Astronomy) は 213 を返す")
    void starrySkyFromExpandedLabels() {
        for (String name : List.of("Galaxy", "Constellation", "Nebula", "Astronomy")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は星空 (213) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_STARRY_SKY);
        }
    }

    @Test
    @DisplayName("Issue#132 - 夜景: 拡充ラベル (Lighting/Illumination/Nightlife) は単独で 204 を返す")
    void nightViewFromExpandedLabels() {
        for (String name : List.of("Lighting", "Illumination", "Nightlife")) {
            assertThat(mapper.map(List.of(label(name, 80f))).categories())
                    .as("ラベル '%s' は夜景 (204) にマッピングされるべき", name)
                    .containsExactly(CodeConstants.CATEGORY_NIGHT_VIEW);
        }
    }
}
