package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Issue#132: AWS Rekognition のラベル名 → Photlas カテゴリ/天候コードの辞書。
 *
 * <p>{@link RekognitionLabelMapper} の辞書部分のみを切り出した不変データクラス。
 * 元クラスが 600 行超になり可読性が落ちていたため Phase 6 Refactor で分離した。</p>
 *
 * <p>規約:</p>
 * <ul>
 *   <li>キーは全て小文字（マッチング側 {@code normalize()} に合わせる）</li>
 *   <li>複数語はスペース区切り（例: "sports car", "night sky"）</li>
 *   <li>マッピングが難しいラベルは登録しない（その他扱い）</li>
 * </ul>
 */
final class CategoryDictionary {

    private CategoryDictionary() {
        // 定数ホルダー専用
    }

    /**
     * Rekognition ラベル（小文字） → Photlas カテゴリコード配列。
     *
     * <p>Issue#132 で網羅性を拡充し、約 270 エントリ規模。</p>
     */
    static final Map<String, List<Integer>> LABEL_TO_CATEGORIES = Map.ofEntries(
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
            // Issue#159 ③-4: 夕日/朝日/夜明け/黄昏 は自然風景の判定対象から除外（タグも削除）
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
            // Issue#141 後追い: 「駅」は鉄道カテゴリではなく建造物カテゴリで判定する
            Map.entry("train station", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
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
            // Issue#141 後追い (#5): udon / soba を追加（Rekognition 標準ラベル想定）
            Map.entry("udon", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("soba", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("dessert", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("beverage", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("fruit", List.of(CodeConstants.CATEGORY_GOURMET)),
            // Issue#141 後追い (#5): vegetable は削除
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
            // Issue#141 後追い (#5): soup / noodle は削除
            Map.entry("curry", List.of(CodeConstants.CATEGORY_GOURMET)),
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
            // 植物 (206) - Issue#141 後追い (#4):
            //   - 削除: tree/leaf/petal/vegetation/moss/bush/grass/lawn/blossom/bamboo/fern (11 件)
            //   - vineyard は 206 → 214 (その他) へ移動
            Map.entry("flower", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("plant", List.of(CodeConstants.CATEGORY_PLANTS)),
            // Issue#159 ③-5: 庭園はレジャー・施設(215)へ付け替え
            Map.entry("garden", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("branch", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("shrub", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("rose", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("tulip", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("cherry blossom", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sunflower", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lily", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("orchid", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("daisy", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lavender", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("cactus", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("vine", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("ivy", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("jungle", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("woodland", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sapling", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("sprout", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("hedge", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("foliage", List.of(CodeConstants.CATEGORY_PLANTS)),
            // Issue#159 ③-5: ぶどう畑(果樹園)はレジャー・施設(215)へ付け替え
            Map.entry("vineyard", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            // 動物 (207)
            Map.entry("animal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // Issue#141 後追い (#3): owl/peacock/flamingo/penguin は野鳥 (208) → 動物 (207) のみに移動
            Map.entry("owl", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("peacock", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("flamingo", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("penguin", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dog", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("cat", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // mammal: 直接ラベルとしては 207 にマッピングする（Issue#119 互換）。
            // Issue#132 では「親ラベル」としての mammal を BLACKLISTED_PARENTS で除外する。
            // Issue#141 後追い (#3): mammal/wildlife/pet は「動物全般 (animal)」に含めるため削除
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
            // Issue#141 後追い (#3): butterfly は削除
            Map.entry("bee", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dragonfly", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("puppy", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("kitten", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // Issue#159 ③-21: オウム・インコは野鳥(208)へ付け替え
            Map.entry("parrot", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            // 野鳥 (208) - Issue#141 後追い (#3): 207 (動物) を外して 208 のみへ
            // owl/peacock/flamingo/penguin は上の動物セクションへ移動 (CATEGORY_ANIMALS のみ)
            // crow/goose/duck/seagull/pigeon は tag 削除に合わせて削除
            Map.entry("bird", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("sparrow", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("eagle", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("hawk", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("heron", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("crane", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("falcon", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("pelican", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("hummingbird", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("woodpecker", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("robin", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("stork", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("pheasant", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("kingfisher", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("swan", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("dove", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            // 自動車 (209) - Issue#141 後追い (#3): vehicle/sedan/convertible/taxi は削除
            Map.entry("car", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("automobile", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("suv", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("truck", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("sports car", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("pickup truck", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("minivan", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("hatchback", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("coupe", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("van", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("bus", List.of(CodeConstants.CATEGORY_CARS)),
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
            // 飛行機 (212) - Issue#141 後追い (#3): aircraft tag は削除済だが、
            // Rekognition の "Aircraft" ラベルは引き続き 212 に判定する (「飛行機全般に含める」の意図)
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
            // Issue#141 後追い (#3): astronomy は削除
            Map.entry("aurora", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            // ================= Issue#159 追加分 =================
            // ③-5 レジャー・施設 (215)。既存の garden(→215)/vineyard(→215) は上で付け替え済み。
            Map.entry("park", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("hot spring", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("amusement park", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("theme park", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("zoo", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("aquarium", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("farm", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("ranch", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("pasture", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("campground", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("camping", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("campsite", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("orchard", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("ski", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("piste", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("slope", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("golf course", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("marina", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("harbor", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            Map.entry("port", List.of(CodeConstants.CATEGORY_LEISURE_FACILITY)),
            // ③-7 飛行機 (212): 軍用機
            Map.entry("warplane", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            // ③-11/③-16 野鳥 (208): ◎ 追加（woodpecker/pelican/hummingbird/stork は既存・parrot は付け替え済）
            Map.entry("cormorant", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("mandarin duck", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("toucan", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("ostrich", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("macaw", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            Map.entry("vulture", List.of(CodeConstants.CATEGORY_WILD_BIRDS)),
            // ③-12/③-16 植物 (206): ◎ 追加
            Map.entry("wisteria", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("poppy", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("lotus", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("cosmos", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("hibiscus", List.of(CodeConstants.CATEGORY_PLANTS)),
            // ③-13 グルメ (205): ◎ 追加
            Map.entry("taco", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("burrito", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("pretzel", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("paella", List.of(CodeConstants.CATEGORY_GOURMET)),
            // ③-16 自然風景 (201): ◎ 追加（iceberg は既存）
            Map.entry("coral reef", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("mangrove", List.of(CodeConstants.CATEGORY_NATURE)),
            // ③-16 建造物 (203): ◎ 追加
            Map.entry("palace", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("windmill", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("ruins", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            // ③-16 動物 (207): ◎ 追加（kangaroo/koala/otter/cheetah は既存）
            Map.entry("hippopotamus", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("rhinoceros", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("camel", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("gorilla", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("chimpanzee", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("raccoon", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("sloth", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("alpaca", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("meerkat", List.of(CodeConstants.CATEGORY_ANIMALS))
    );

    /** Rekognition ラベル（小文字） → Photlas 天候コード。 */
    static final Map<String, Integer> LABEL_TO_WEATHER = Map.of(
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
     * Issue#132 3.2: 親ラベル検索の対象外とする「広すぎる」「人間を含む」ラベル群（小文字）。
     *
     * <p>人間が含まれる概念や、ほぼ全ての屋外写真にヒットしてしまう汎用ラベルを除外することで、
     * 親フォールバックによる誤マッピング（例: 人物写真に動物カテゴリが付く）を防ぐ。</p>
     *
     * <p>{@code Wildlife} は人間を含まず動物と強く結びつくため、ここには含めない。</p>
     */
    static final Set<String> BLACKLISTED_PARENTS = Set.of(
            // 人間が含まれる概念
            "mammal", "vertebrate", "person", "human", "adult", "people", "face", "portrait",
            // 広すぎる概念
            "living thing", "organism", "creature", "object", "indoors", "outdoors", "nature",
            // 無関係な汎用概念
            "accessories", "apparel", "clothing"
    );
}
