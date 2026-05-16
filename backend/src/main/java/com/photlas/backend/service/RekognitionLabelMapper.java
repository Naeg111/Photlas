package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.CodeConstants;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Issue#119: AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードにマッピングする。
 *
 * <p>マッピングルール詳細は Issue#119 の 4.1 / 4.2 を参照。</p>
 *
 * <p>主な責務:</p>
 * <ul>
 *   <li>信頼度70%未満のラベルを除外</li>
 *   <li>ラベル名 → Photlas カテゴリ/天候コードへの辞書ベース変換（大文字小文字を無視）</li>
 *   <li>「夜景」の組合せ判定（Night + City/Building/Architecture）</li>
 *   <li>「野鳥」の二重候補（Bird → 動物 207 + 野鳥 208）</li>
 *   <li>天候は信頼度最高ラベルを単一採用</li>
 * </ul>
 */
@Component
public class RekognitionLabelMapper {

    /** Issue#119 4.5: Rekognition 呼び出し時の MinConfidence と同値。80% 未満は除外する。 */
    private static final float CONFIDENCE_THRESHOLD = 80f;

    /** 「夜景」組合せ判定用の親ラベル（このラベル単独ではマッピングしない）。 */
    private static final String NIGHT_LABEL = "night";

    /** 「夜景」と組み合わせて 204 を成立させる相棒ラベル群。 */
    private static final Set<String> NIGHT_VIEW_PARTNER_LABELS = Set.of(
            "city", "building", "architecture"
    );

    /**
     * Issue#132 3.2: 親ラベル経由マッピングの信頼度減衰係数。
     * 親は子より広い概念なので不確実性が高いため 0.8 倍する。
     */
    private static final float PARENT_FALLBACK_DECAY = 0.8f;

    /**
     * Issue#132 3.2: 親ラベル検索の対象外とする「広すぎる」「人間を含む」ラベル群（小文字）。
     *
     * <p>人間が含まれる概念や、ほぼ全ての屋外写真にヒットしてしまう汎用ラベルを除外することで、
     * 親フォールバックによる誤マッピング（例: 人物写真に動物カテゴリが付く）を防ぐ。</p>
     *
     * <p>{@code Wildlife} は人間を含まず動物と強く結びつくため、ここには含めない。</p>
     */
    private static final Set<String> BLACKLISTED_PARENTS = Set.of(
            // 人間が含まれる概念
            "mammal", "vertebrate", "person", "human", "adult", "people", "face", "portrait",
            // 広すぎる概念
            "living thing", "organism", "creature", "object", "indoors", "outdoors", "nature",
            // 無関係な汎用概念
            "accessories", "apparel", "clothing"
    );

    /**
     * Rekognition ラベル（小文字） → Photlas カテゴリコード配列。
     *
     * <p>Issue#132 で網羅性を拡充。AWS Rekognition の代表ラベルを Photlas のカテゴリにマッピングする。
     * 200〜300 エントリ規模。マッピング判断が難しいラベルは登録しない（その他扱い）。</p>
     */
    private static final Map<String, List<Integer>> LABEL_TO_CATEGORIES = Map.ofEntries(
            // 自然風景 (201)
            Map.entry("mountain", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("sea", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("river", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("forest", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("landscape", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("scenery", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("panoramic", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("waterfall", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("cliff", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("beach", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("valley", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("lake", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("coast", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("coastline", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("shoreline", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("shore", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("pond", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("glacier", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("iceberg", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("canyon", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("gorge", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("desert", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("wetland", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("field", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("meadow", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("hill", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("stream", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("creek", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("brook", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("rapids", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("volcano", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("cave", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("cavern", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("rainbow", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("sunset", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("sunrise", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("dawn", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("dusk", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("horizon", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("island", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("bay", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("lagoon", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("reef", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("ocean", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("waves", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("wave", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("marsh", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("swamp", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("peninsula", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("plateau", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("summit", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("peak", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("ridge", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("dune", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("oasis", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("fjord", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("countryside", List.of(CodeConstants.CATEGORY_NATURE)),
            // 街並み (202)
            Map.entry("city", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("skyline", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("urban", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("cityscape", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("downtown", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("town", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("metropolis", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("neighborhood", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("street", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("avenue", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("alley", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("alleyway", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("road", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("intersection", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("crosswalk", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("plaza", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            // 建造物 (203)
            Map.entry("building", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("architecture", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("bridge", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("tower", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("skyscraper", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("castle", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("temple", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("shrine", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("church", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("cathedral", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("mosque", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("pagoda", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("pyramid", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("monument", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("fortress", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("tunnel", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("lighthouse", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("stadium", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("arena", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("dam", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("pier", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("wharf", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("pavilion", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("mansion", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("house", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("cottage", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("hotel", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("factory", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("warehouse", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("barn", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("gate", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("torii", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("fence", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            // 夜景 (204) - Issue#132: 単独で 204 を成立させるラベル
            Map.entry("lighting", List.of(CodeConstants.CATEGORY_NIGHT_VIEW)),
            Map.entry("illumination", List.of(CodeConstants.CATEGORY_NIGHT_VIEW)),
            Map.entry("nightlife", List.of(CodeConstants.CATEGORY_NIGHT_VIEW)),
            Map.entry("neon", List.of(CodeConstants.CATEGORY_NIGHT_VIEW)),
            // グルメ (205)
            Map.entry("food", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("meal", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("restaurant", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("dish", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cuisine", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("bread", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("toast", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cake", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("coffee", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("sushi", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("ramen", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("dessert", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("beverage", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("fruit", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("vegetable", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("pasta", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("pizza", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("sandwich", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("burger", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("hamburger", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("donut", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("doughnut", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cookie", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("pancake", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("waffle", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("salad", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("soup", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("curry", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("noodle", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("rice", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cheese", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("sausage", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("bacon", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("egg", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("drink", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("wine", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("beer", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cocktail", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("tea", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("juice", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("ice cream", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("chocolate", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("candy", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("steak", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("seafood", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("shrimp", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("salmon", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("snack", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("confectionery", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("bakery", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cafe", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("breakfast", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("lunch", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("dinner", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("apple", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("orange", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("banana", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("grape", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("strawberry", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("lemon", List.of(CodeConstants.CATEGORY_GOURMET)),
            // 植物 (206)
            Map.entry("flower", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("plant", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("tree", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("garden", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("leaf", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("petal", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("branch", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("vegetation", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("moss", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("bush", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("vineyard", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("grass", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lawn", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("shrub", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("blossom", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("rose", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("tulip", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("cherry blossom", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sunflower", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lily", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("orchid", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("daisy", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lavender", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("cactus", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("bamboo", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("fern", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("vine", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("ivy", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("jungle", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("woodland", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sapling", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sprout", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("hedge", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("foliage", List.of(CodeConstants.CATEGORY_PLANTS)),
            // 動物 (207)
            Map.entry("animal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dog", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("cat", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // mammal: 直接ラベルとしては 207 にマッピングする（Issue#119 互換）。
            // Issue#132 では「親ラベル」としての mammal を BLACKLISTED_PARENTS で除外する。
            Map.entry("mammal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("wildlife", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("pet", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("fox", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("bear", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("deer", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("squirrel", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("rabbit", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("lion", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("tiger", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("elephant", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("giraffe", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("zebra", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("horse", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("cow", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("sheep", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("goat", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("pig", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("monkey", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("wolf", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("leopard", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("cheetah", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("panda", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("kangaroo", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("koala", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("otter", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("whale", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dolphin", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("seal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("snake", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("lizard", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("turtle", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("tortoise", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("crocodile", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("alligator", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("frog", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("insect", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("butterfly", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("bee", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dragonfly", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("puppy", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("kitten", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("parrot", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // 動物 + 野鳥 (207 + 208) - Bird 系は二重候補
            Map.entry("bird", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("sparrow", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("eagle", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("hawk", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("owl", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("crow", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("heron", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("crane", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("falcon", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("pelican", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("hummingbird", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("woodpecker", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("robin", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("flamingo", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("stork", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("pheasant", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("kingfisher", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("swan", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("goose", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("pigeon", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("dove", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("seagull", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("duck", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("penguin", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            // 自動車 (209)
            Map.entry("car", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("vehicle", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("automobile", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("sedan", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("suv", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("truck", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("sports car", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("pickup truck", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("convertible", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("minivan", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("hatchback", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("coupe", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("van", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("bus", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("taxi", List.of(CodeConstants.CATEGORY_CARS)),
            // バイク (210)
            Map.entry("motorcycle", List.of(CodeConstants.CATEGORY_MOTORCYCLES)),
            Map.entry("scooter", List.of(CodeConstants.CATEGORY_MOTORCYCLES)),
            Map.entry("moped", List.of(CodeConstants.CATEGORY_MOTORCYCLES)),
            // 鉄道 (211)
            Map.entry("train", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("railway", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("locomotive", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("subway", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("tram", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("cable car", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("monorail", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("bullet train", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("streetcar", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("trolley", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            // 飛行機 (212)
            Map.entry("aircraft", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("airplane", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("helicopter", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("jet", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("airliner", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("biplane", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("glider", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("seaplane", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            // 星空 (213)
            Map.entry("star", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("night sky", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("milky way", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("galaxy", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("constellation", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("nebula", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("astronomy", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("aurora", List.of(CodeConstants.CATEGORY_STARRY_SKY))
    );

    /** Rekognition ラベル（小文字） → Photlas 天候コード。 */
    private static final Map<String, Integer> LABEL_TO_WEATHER = Map.of(
            "blue sky", CodeConstants.WEATHER_SUNNY,
            "sunshine", CodeConstants.WEATHER_SUNNY,
            "clear", CodeConstants.WEATHER_SUNNY,
            "cloud", CodeConstants.WEATHER_CLOUDY,
            "overcast", CodeConstants.WEATHER_CLOUDY,
            "rain", CodeConstants.WEATHER_RAIN,
            "wet", CodeConstants.WEATHER_RAIN,
            "snow", CodeConstants.WEATHER_SNOW,
            "winter", CodeConstants.WEATHER_SNOW
    );

    /**
     * Rekognition のラベル一覧を Photlas のカテゴリ・天候へマッピングする。
     *
     * @param labels Rekognition {@code DetectLabels} API の戻り値（{@code response.labels()}）
     * @return マッピング結果。信頼度70%未満のラベルは除外される。
     */
    public LabelMappingResult map(List<Label> labels) {
        List<Label> qualified = filterByConfidence(labels);
        CategoryMapping categoryMapping = mapCategories(qualified);
        WeatherMapping weatherMapping = mapWeather(qualified);
        return combine(categoryMapping, weatherMapping);
    }

    private static List<Label> filterByConfidence(List<Label> labels) {
        return labels.stream()
                .filter(l -> l.confidence() != null && l.confidence() >= CONFIDENCE_THRESHOLD)
                .toList();
    }

    private static String normalize(String labelName) {
        return labelName.toLowerCase(Locale.ROOT);
    }

    /** ラベル群からカテゴリ群を構築する（夜景の組合せ判定と Issue#132 親フォールバックを含む）。 */
    private static CategoryMapping mapCategories(List<Label> qualified) {
        Set<Integer> codes = new LinkedHashSet<>();
        Map<String, Float> confidence = new LinkedHashMap<>();
        NightViewState nightViewState = new NightViewState();

        for (Label label : qualified) {
            String name = normalize(label.name());
            float conf = label.confidence();

            if (NIGHT_LABEL.equals(name)) {
                nightViewState.recordNight(conf);
                continue;
            }
            if (NIGHT_VIEW_PARTNER_LABELS.contains(name)) {
                nightViewState.recordPartner(conf);
            }

            List<Integer> mapped = LABEL_TO_CATEGORIES.get(name);
            if (mapped != null) {
                applyCodes(codes, confidence, mapped, conf);
                continue;
            }

            // Issue#132 3.2: 子ラベル未マッチ → 親ラベルを順に検索（最初のヒットを採用）
            findParentFallbackCodes(label).ifPresent(parentHit ->
                    applyCodes(codes, confidence, parentHit.codes(), conf * PARENT_FALLBACK_DECAY));
        }

        nightViewState.applyTo(codes, confidence);
        return new CategoryMapping(codes, confidence);
    }

    /** カテゴリ群と信頼度マップに、与えられたコード群を追加する（既存値とは最大値マージ）。 */
    private static void applyCodes(
            Set<Integer> codes, Map<String, Float> confidence,
            List<Integer> mapped, float conf) {
        for (Integer code : mapped) {
            codes.add(code);
            confidence.merge(String.valueOf(code), conf, Math::max);
        }
    }

    /**
     * Issue#132 3.2: 親ラベルを順に検索し、ブラックリストでない最初のヒットを返す。
     * 該当なしなら空 Optional。
     */
    private static Optional<ParentHit> findParentFallbackCodes(Label label) {
        if (label.parents() == null) {
            return Optional.empty();
        }
        for (var parent : label.parents()) {
            if (parent.name() == null) {
                continue;
            }
            String parentName = normalize(parent.name());
            if (BLACKLISTED_PARENTS.contains(parentName)) {
                continue;
            }
            List<Integer> parentMapped = LABEL_TO_CATEGORIES.get(parentName);
            if (parentMapped != null) {
                return Optional.of(new ParentHit(parentName, parentMapped));
            }
        }
        return Optional.empty();
    }

    /** 親フォールバックで採用された親ラベル名とマッピング先カテゴリ群。 */
    private record ParentHit(String parentName, List<Integer> codes) {
    }

    /** ラベル群から信頼度最高の天候を選定する。該当なしなら code = null。 */
    private static WeatherMapping mapWeather(List<Label> qualified) {
        Integer bestCode = null;
        float bestConf = -1f;
        for (Label label : qualified) {
            Integer code = LABEL_TO_WEATHER.get(normalize(label.name()));
            if (code != null && label.confidence() > bestConf) {
                bestCode = code;
                bestConf = label.confidence();
            }
        }
        return new WeatherMapping(bestCode, bestCode != null ? bestConf : null);
    }

    private static LabelMappingResult combine(CategoryMapping categories, WeatherMapping weather) {
        Map<String, Float> confidence = new LinkedHashMap<>(categories.confidence());
        if (weather.code() != null) {
            confidence.put(String.valueOf(weather.code()), weather.confidence());
        }
        return new LabelMappingResult(new ArrayList<>(categories.codes()), weather.code(), confidence);
    }

    /** カテゴリマッピング結果（コード集合 + 信頼度マップ）。内部使用のみ。 */
    private record CategoryMapping(Set<Integer> codes, Map<String, Float> confidence) {
    }

    /** 天候マッピング結果。code が null なら採用なし。 */
    private record WeatherMapping(Integer code, Float confidence) {
    }

    /**
     * 「夜景」(204) の組合せ判定状態。Night ラベルと相棒ラベル（City/Building/Architecture）
     * の両方が信頼度70%以上で揃った場合に 204 を成立させる。
     */
    private static final class NightViewState {
        private boolean hasNight = false;
        private float nightConfidence = 0f;
        private boolean hasPartner = false;
        private float partnerConfidence = 0f;

        void recordNight(float confidence) {
            hasNight = true;
            nightConfidence = confidence;
        }

        void recordPartner(float confidence) {
            hasPartner = true;
            partnerConfidence = Math.max(partnerConfidence, confidence);
        }

        void applyTo(Set<Integer> codes, Map<String, Float> confidenceMap) {
            if (!hasNight || !hasPartner) {
                return;
            }
            codes.add(CodeConstants.CATEGORY_NIGHT_VIEW);
            // 組合せの「弱い側」を信頼度として記録（両方が揃って初めて成立するため）
            confidenceMap.put(
                    String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW),
                    Math.min(nightConfidence, partnerConfidence)
            );
        }
    }
}
