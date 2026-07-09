-- Issue#159 ③: 詳細カテゴリー(タグ)の全面整理（削除・統合・移動・新設・改名・国際追加）
--
-- カテゴリー判定(大)は CategoryDictionary(Java) が担い、詳細カテゴリー(タグ)は本テーブルが担う
-- 完全に独立した別経路（Issue#159 3.7）。よって本マイグレーションは tags / tag_categories /
-- photo_tags のみを対象とし、カテゴリー判定辞書(CategoryDictionary)・カテゴリーマスタ(DataLoader)は
-- 別途 Java 側で変更する。
--
-- 削除方式（Issue#159 Q8）: 物理削除。photo_tags(FK ON DELETE RESTRICT) を先に削除 →
--   tags を削除（tag_categories は FK ON DELETE CASCADE で自動削除）。
-- 本番 photo_tags は 0 行のため実質タグ定義のみの変更だが、ローカル/将来のため子から順に消す。
--
-- 翻訳方針（V36 慣例）: ja/en は監修、zh(簡体)/ko/es は機械翻訳ベースの一次案。
--   同一概念の同義タグ（例 Farm/Ranch/Pasture=牧場）は全言語で表示名を揃える（UI でグループ表示）。

-- ========================================================================
-- ③-1 街並み(202): 12 タグ全削除（カテゴリー判定は CategoryDictionary で維持）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('city','skyline','urban','cityscape','downtown','town','metropolis','neighborhood','street','avenue','alley','plaza'));
DELETE FROM tags WHERE slug IN
  ('city','skyline','urban','cityscape','downtown','town','metropolis','neighborhood','street','avenue','alley','plaza');

-- ========================================================================
-- ③-2 自然風景(201) A群: タグ削除・判定維持（湾/洞窟/崖/海岸/丘/風景/大洋/山頂/虹/谷/キノコ）
--   ※ mushroom は 201,206 の二重所属。ここで削除すると両方から消える（③-12 の松等とは別に処理済）。
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('bay','cave','cliff','coast','hill','landscape','ocean','peak','rainbow','valley','mushroom'));
DELETE FROM tags WHERE slug IN
  ('bay','cave','cliff','coast','hill','landscape','ocean','peak','rainbow','valley','mushroom');

-- ========================================================================
-- ③-3 小川(stream) → 川(river) 統合: photo_tags を付け替えてから stream を削除
--   ※ 本番 photo_tags は空。同一写真が stream/river 両方を持つ場合は PK 重複しうるが、
--     現データ無しのため単純 UPDATE で足りる。
-- ========================================================================
UPDATE photo_tags SET tag_id = (SELECT id FROM tags WHERE slug='river')
  WHERE tag_id = (SELECT id FROM tags WHERE slug='stream');
DELETE FROM tags WHERE slug='stream';

-- ========================================================================
-- ③-4 自然風景(201) C群: タグ削除・判定も除外（雲/夜明け/黄昏/霧/氷/朝日/夕日）
--   判定辞書からの Dawn/Dusk/Sunrise/Sunset 削除は CategoryDictionary(Java) で対応。
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('cloud','dawn','dusk','fog','ice','sunrise','sunset'));
DELETE FROM tags WHERE slug IN ('cloud','dawn','dusk','fog','ice','sunrise','sunset');

-- ========================================================================
-- ③-6 自動車(209)・バイク(210): 詳細タグ全削除（判定は維持）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('car','sports-car','suv','pickup-truck','bus','truck','motorcycle','scooter','moped'));
DELETE FROM tags WHERE slug IN
  ('car','sports-car','suv','pickup-truck','bus','truck','motorcycle','scooter','moped');

-- ========================================================================
-- ③-7 飛行機(212): 飛行機全般/ジェット機/グライダー/ドローン を削除（旅客機/ヘリ/熱気球は残す）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('airplane','jet','glider','drone'));
DELETE FROM tags WHERE slug IN ('airplane','jet','glider','drone');

-- ========================================================================
-- ③-8 星空(213): 夜空/銀河/星雲 を削除。Star タグの表示名を「星空」に変更（天文は既に無し）
--   カテゴリー名 213「星空」→「星」の変更は DataLoader(Java) で対応。
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('night-sky','galaxy','nebula'));
DELETE FROM tags WHERE slug IN ('night-sky','galaxy','nebula');
UPDATE tags SET display_name_ja='星空', display_name_en='Starry Sky', display_name_zh='星空',
  display_name_ko='별이 빛나는 하늘', display_name_es='Cielo estrellado' WHERE slug='star';

-- ========================================================================
-- ③-9 鉄道(211): 地下鉄を削除。鉄道全般(railway)→「その他」に改名。並び替え。
--   順: 新幹線→機関車→路面電車→モノレール→ケーブルカー→その他
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug='subway');
DELETE FROM tags WHERE slug='subway';
UPDATE tags SET display_name_ja='その他', display_name_en='Other', display_name_zh='其他',
  display_name_ko='기타', display_name_es='Otros' WHERE slug='railway';
UPDATE tags SET sort_order=10 WHERE slug='bullet-train';
UPDATE tags SET sort_order=20 WHERE slug='locomotive';
UPDATE tags SET sort_order=30 WHERE slug='tram';
UPDATE tags SET sort_order=40 WHERE slug='monorail';
UPDATE tags SET sort_order=50 WHERE slug='cable-car';
UPDATE tags SET sort_order=60 WHERE slug='railway';

-- ========================================================================
-- ③-10 動物(207): 動物全般/鳥(companion-bird)/クジャク/フラミンゴ/オオカミ を削除
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('animal','companion-bird','peacock','flamingo','wolf'));
DELETE FROM tags WHERE slug IN ('animal','companion-bird','peacock','flamingo','wolf');

-- ========================================================================
-- ③-11 野鳥(208): 野鳥全般(bird) を削除（種の追加は後述の新タグセクション）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug='bird');
DELETE FROM tags WHERE slug='bird';

-- ========================================================================
-- ③-12 植物(206): 植物全般/蘭/花/松 を削除（キノコは ③-2 で削除済）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('plant','orchid','flower','pine'));
DELETE FROM tags WHERE slug IN ('plant','orchid','flower','pine');

-- ========================================================================
-- ③-13 グルメ(205): グルメ全般(food) を削除（海外料理の追加は後述）
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug='food');
DELETE FROM tags WHERE slug='food';

-- ========================================================================
-- ③-14 建造物(203): 建造物全般/門/五重塔/桟橋/パビリオン を削除
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (SELECT id FROM tags WHERE slug IN
  ('building','gate','pagoda','pier','pavilion'));
DELETE FROM tags WHERE slug IN ('building','gate','pagoda','pier','pavilion');

-- ========================================================================
-- ③-15 夜景(204): 表示統合（タグは残す）。ライティング→「イルミネーション」、ナイトライフ→「ネオン」
--   グルーピングを言語横断で成立させるため、illumination/neon と全言語の表示名を一致させる。
-- ========================================================================
UPDATE tags SET display_name_ja='イルミネーション', display_name_en='Illumination', display_name_zh='灯饰',
  display_name_ko='일루미네이션', display_name_es='Alumbrado' WHERE slug='lighting';
UPDATE tags SET display_name_ja='ネオン', display_name_en='Neon', display_name_zh='霓虹',
  display_name_ko='네온', display_name_es='Neón' WHERE slug='nightlife';

-- ========================================================================
-- ③-5 レジャー・施設(215) への移動: 温泉(201→)/庭園(206→)/ぶどう畑(214→)
--   ぶどう畑(vineyard) は表示名を「果樹園」に変更し Orchard と統合表示。並び順も 215 用に調整。
-- ========================================================================
UPDATE tag_categories SET category_code=215 WHERE tag_id=(SELECT id FROM tags WHERE slug='hot-spring');
UPDATE tag_categories SET category_code=215 WHERE tag_id=(SELECT id FROM tags WHERE slug='garden');
UPDATE tag_categories SET category_code=215 WHERE tag_id=(SELECT id FROM tags WHERE slug='vineyard');
UPDATE tags SET sort_order=20 WHERE slug='hot-spring';
UPDATE tags SET sort_order=110 WHERE slug='garden';
UPDATE tags SET sort_order=80, display_name_ja='果樹園', display_name_en='Orchard', display_name_zh='果园',
  display_name_ko='과수원', display_name_es='Huerto' WHERE slug='vineyard';

-- ========================================================================
-- 新タグ投入（③-5 215 新規19 / ③-7 軍用機・飛行船 / ③-11 野鳥 / ③-12 植物 / ③-13 グルメ /
--   ③-14 建造物 / ③-16 自然風景・動物 の国際追加）
--   同義タグ（牧場=Farm/Ranch/Pasture 等）は全言語で表示名を揃える。
-- ========================================================================

-- ③-5 レジャー・施設(215) の新規タグ 19 件
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Park', 'park', '公園', 'Park', '公园', '공원', 'Parque', 10),
  ('Amusement Park', 'amusement-park', '遊園地', 'Amusement Park', '游乐园', '놀이공원', 'Parque de atracciones', 30),
  ('Theme Park', 'theme-park', '遊園地', 'Amusement Park', '游乐园', '놀이공원', 'Parque de atracciones', 30),
  ('Zoo', 'zoo', '動物園', 'Zoo', '动物园', '동물원', 'Zoológico', 40),
  ('Aquarium', 'aquarium', '水族館', 'Aquarium', '水族馆', '아쿠아리움', 'Acuario', 50),
  ('Farm', 'farm', '牧場', 'Ranch', '牧场', '목장', 'Rancho', 60),
  ('Ranch', 'ranch', '牧場', 'Ranch', '牧场', '목장', 'Rancho', 60),
  ('Pasture', 'pasture', '牧場', 'Ranch', '牧场', '목장', 'Rancho', 60),
  ('Campground', 'campground', 'キャンプ場', 'Campground', '露营地', '캠핑장', 'Camping', 70),
  ('Camping', 'camping', 'キャンプ場', 'Campground', '露营地', '캠핑장', 'Camping', 70),
  ('Campsite', 'campsite', 'キャンプ場', 'Campground', '露营地', '캠핑장', 'Camping', 70),
  ('Orchard', 'orchard', '果樹園', 'Orchard', '果园', '과수원', 'Huerto', 80),
  ('Ski', 'ski', 'スキー場', 'Ski Resort', '滑雪场', '스키장', 'Estación de esquí', 90),
  ('Piste', 'piste', 'スキー場', 'Ski Resort', '滑雪场', '스키장', 'Estación de esquí', 90),
  ('Slope', 'slope', 'スキー場', 'Ski Resort', '滑雪场', '스키장', 'Estación de esquí', 90),
  ('Golf Course', 'golf-course', 'ゴルフ場', 'Golf Course', '高尔夫球场', '골프장', 'Campo de golf', 100),
  ('Marina', 'marina', '港・マリーナ', 'Marina', '码头', '항구', 'Puerto deportivo', 120),
  ('Harbor', 'harbor', '港・マリーナ', 'Marina', '码头', '항구', 'Puerto deportivo', 120),
  ('Port', 'port', '港・マリーナ', 'Marina', '码头', '항구', 'Puerto deportivo', 120);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 215 FROM tags WHERE slug IN
  ('park','amusement-park','theme-park','zoo','aquarium','farm','ranch','pasture','campground','camping','campsite',
   'orchard','ski','piste','slope','golf-course','marina','harbor','port');

-- ③-7 飛行機(212): 軍用機 + ③-16 飛行船
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Warplane', 'warplane', '軍用機', 'Warplane', '军用机', '군용기', 'Avión de guerra', 80),
  ('Airship', 'airship', '飛行船', 'Airship', '飞艇', '비행선', 'Dirigible', 90);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 212 FROM tags WHERE slug IN ('warplane','airship');

-- ③-11 + ③-16 野鳥(208): 国内種 11 + 海外種 8
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Woodpecker', 'woodpecker', 'コゲラ', 'Woodpecker', '啄木鸟', '딱따구리', 'Pájaro carpintero', 100),
  ('Cormorant', 'cormorant', 'カワウ', 'Cormorant', '鸬鹚', '가마우지', 'Cormorán', 110),
  ('Mandarin Duck', 'mandarin-duck', 'オシドリ', 'Mandarin Duck', '鸳鸯', '원앙', 'Pato mandarín', 120),
  ('Japanese White-eye', 'mejiro', 'メジロ', 'Japanese White-eye', '绣眼鸟', '동박새', 'Anteojitos japonés', 130),
  ('Japanese Tit', 'shijukara', 'シジュウカラ', 'Japanese Tit', '远东山雀', '박새', 'Carbonero japonés', 140),
  ('Varied Tit', 'yamagara', 'ヤマガラ', 'Varied Tit', '杂色山雀', '곤줄박이', 'Carbonero variado', 150),
  ('Blue-and-white Flycatcher', 'ohruri', 'オオルリ', 'Blue-and-white Flycatcher', '白腹蓝鹟', '큰유리새', 'Papamoscas azul', 160),
  ('Narcissus Flycatcher', 'kibitaki', 'キビタキ', 'Narcissus Flycatcher', '黄眉姬鹟', '황금새', 'Papamoscas narciso', 170),
  ('Bull-headed Shrike', 'mozu', 'モズ', 'Bull-headed Shrike', '红头伯劳', '때까치', 'Alcaudón', 180),
  ('Brown-eared Bulbul', 'hiyodori', 'ヒヨドリ', 'Brown-eared Bulbul', '栗耳短脚鹎', '직박구리', 'Bulbul orejipardo', 190),
  ('Rock Ptarmigan', 'raicho', 'ライチョウ', 'Rock Ptarmigan', '岩雷鸟', '뇌조', 'Lagópodo alpino', 200),
  ('Parrot', 'parrot', 'オウム・インコ', 'Parrot', '鹦鹉', '앵무새', 'Loro', 210),
  ('Macaw', 'macaw', 'コンゴウインコ', 'Macaw', '金刚鹦鹉', '마코앵무', 'Guacamayo', 220),
  ('Hummingbird', 'hummingbird', 'ハチドリ', 'Hummingbird', '蜂鸟', '벌새', 'Colibrí', 230),
  ('Toucan', 'toucan', 'オオハシ', 'Toucan', '巨嘴鸟', '큰부리새', 'Tucán', 240),
  ('Pelican', 'pelican', 'ペリカン', 'Pelican', '鹈鹕', '펠리컨', 'Pelícano', 250),
  ('Ostrich', 'ostrich', 'ダチョウ', 'Ostrich', '鸵鸟', '타조', 'Avestruz', 260),
  ('Stork', 'stork', 'コウノトリ', 'Stork', '鹳', '황새', 'Cigüeña', 270),
  ('Vulture', 'vulture', 'ハゲワシ・コンドル', 'Vulture', '秃鹫', '독수리', 'Buitre', 280);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 208 FROM tags WHERE slug IN
  ('woodpecker','cormorant','mandarin-duck','mejiro','shijukara','yamagara','ohruri','kibitaki','mozu','hiyodori',
   'raicho','parrot','macaw','hummingbird','toucan','pelican','ostrich','stork','vulture');

-- ③-12 + ③-16 植物(206): 国内 11 + 海外 6
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Wisteria', 'wisteria', '藤', 'Wisteria', '紫藤', '등나무', 'Glicina', 200),
  ('Poppy', 'poppy', 'ポピー', 'Poppy', '罂粟', '양귀비', 'Amapola', 210),
  ('Lotus', 'lotus', '蓮', 'Lotus', '莲花', '연꽃', 'Loto', 220),
  ('Cosmos', 'cosmos', 'コスモス', 'Cosmos', '大波斯菊', '코스모스', 'Cosmos', 230),
  ('Nemophila', 'nemophila', 'ネモフィラ', 'Nemophila', '粉蝶花', '네모필라', 'Nemophila', 240),
  ('Moss Phlox', 'shibazakura', '芝桜', 'Moss Phlox', '芝樱', '잔디벚꽃', 'Flox musgoso', 250),
  ('Rapeseed Blossom', 'nanohana', '菜の花', 'Rapeseed Blossom', '油菜花', '유채꽃', 'Flor de colza', 260),
  ('Red Spider Lily', 'higanbana', '彼岸花', 'Red Spider Lily', '彼岸花', '꽃무릇', 'Lirio araña roja', 270),
  ('Plum Blossom', 'ume', '梅', 'Plum Blossom', '梅花', '매화', 'Flor de ciruelo', 280),
  ('Kochia', 'kochia', 'コキア', 'Kochia', '地肤', '코키아', 'Kochia', 290),
  ('Ginkgo', 'icho', 'イチョウ', 'Ginkgo', '银杏', '은행나무', 'Ginkgo', 300),
  ('Hibiscus', 'hibiscus', 'ハイビスカス', 'Hibiscus', '芙蓉', '히비스커스', 'Hibisco', 310),
  ('Bougainvillea', 'bougainvillea', 'ブーゲンビリア', 'Bougainvillea', '三角梅', '부겐빌레아', 'Buganvilla', 320),
  ('Plumeria', 'plumeria', 'プルメリア', 'Plumeria', '鸡蛋花', '플루메리아', 'Plumeria', 330),
  ('Jacaranda', 'jacaranda', 'ジャカランダ', 'Jacaranda', '蓝花楹', '자카란다', 'Jacarandá', 340),
  ('Poinsettia', 'poinsettia', 'ポインセチア', 'Poinsettia', '一品红', '포인세티아', 'Flor de pascua', 350),
  ('Protea', 'protea', 'プロテア', 'Protea', '帝王花', '프로테아', 'Protea', 360);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 206 FROM tags WHERE slug IN
  ('wisteria','poppy','lotus','cosmos','nemophila','shibazakura','nanohana','higanbana','ume','kochia','icho',
   'hibiscus','bougainvillea','plumeria','jacaranda','poinsettia','protea');

-- ③-13 グルメ(205): 海外料理 10
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Taco', 'taco', 'タコス', 'Taco', '塔可', '타코', 'Taco', 320),
  ('Burrito', 'burrito', 'ブリトー', 'Burrito', '墨西哥卷饼', '부리토', 'Burrito', 330),
  ('Pretzel', 'pretzel', 'プレッツェル', 'Pretzel', '椒盐卷饼', '프레첼', 'Pretzel', 340),
  ('Paella', 'paella', 'パエリア', 'Paella', '西班牙海鲜饭', '파에야', 'Paella', 350),
  ('Dim Sum', 'dim-sum', '点心', 'Dim Sum', '点心', '딤섬', 'Dim sum', 360),
  ('Pho', 'pho', 'フォー', 'Pho', '越南河粉', '쌀국수', 'Pho', 370),
  ('Borscht', 'borscht', 'ボルシチ', 'Borscht', '罗宋汤', '보르시', 'Borsch', 380),
  ('Kebab', 'kebab', 'ケバブ', 'Kebab', '烤肉串', '케밥', 'Kebab', 390),
  ('Churros', 'churros', 'チュロス', 'Churros', '吉拿棒', '츄러스', 'Churros', 400),
  ('Falafel', 'falafel', 'ファラフェル', 'Falafel', '沙拉三明治', '팔라펠', 'Falafel', 410);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 205 FROM tags WHERE slug IN
  ('taco','burrito','pretzel','paella','dim-sum','pho','borscht','kebab','churros','falafel');

-- ③-16 建造物(203): 国際追加 5（宮殿/遺跡/風車/水道橋/シナゴーグ）
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Palace', 'palace', '宮殿', 'Palace', '宫殿', '궁전', 'Palacio', 400),
  ('Ruins', 'ruins', '遺跡', 'Ruins', '遗迹', '유적', 'Ruinas', 410),
  ('Windmill', 'windmill', '風車', 'Windmill', '风车', '풍차', 'Molino de viento', 420),
  ('Aqueduct', 'aqueduct', '水道橋', 'Aqueduct', '渡槽', '수도교', 'Acueducto', 430),
  ('Synagogue', 'synagogue', 'シナゴーグ', 'Synagogue', '犹太教堂', '시나고그', 'Sinagoga', 440);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 203 FROM tags WHERE slug IN ('palace','ruins','windmill','aqueduct','synagogue');

-- ③-16 自然風景(201): 国際追加 9（サンゴ礁/フィヨルド/サバンナ/氷山/塩湖・塩原/間欠泉/メサ・台地/マングローブ/ツンドラ）
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Coral Reef', 'coral-reef', 'サンゴ礁', 'Coral Reef', '珊瑚礁', '산호초', 'Arrecife de coral', 200),
  ('Fjord', 'fjord', 'フィヨルド', 'Fjord', '峡湾', '피오르', 'Fiordo', 210),
  ('Savanna', 'savanna', 'サバンナ', 'Savanna', '稀树草原', '사바나', 'Sabana', 220),
  ('Iceberg', 'iceberg', '氷山', 'Iceberg', '冰山', '빙산', 'Iceberg', 230),
  ('Salt Lake', 'salt-lake', '塩湖・塩原', 'Salt Lake', '盐湖', '소금호수', 'Lago salado', 240),
  ('Geyser', 'geyser', '間欠泉', 'Geyser', '间歇泉', '간헐천', 'Géiser', 250),
  ('Mesa', 'mesa', 'メサ・台地', 'Mesa', '台地', '메사', 'Mesa', 260),
  ('Mangrove', 'mangrove', 'マングローブ', 'Mangrove', '红树林', '맹그로브', 'Manglar', 270),
  ('Tundra', 'tundra', 'ツンドラ', 'Tundra', '苔原', '툰드라', 'Tundra', 280);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 201 FROM tags WHERE slug IN
  ('coral-reef','fjord','savanna','iceberg','salt-lake','geyser','mesa','mangrove','tundra');

-- ③-16 動物(207): 国際追加 13
INSERT INTO tags (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order) VALUES
  ('Kangaroo', 'kangaroo', 'カンガルー', 'Kangaroo', '袋鼠', '캥거루', 'Canguro', 300),
  ('Koala', 'koala', 'コアラ', 'Koala', '考拉', '코알라', 'Koala', 310),
  ('Gorilla', 'gorilla', 'ゴリラ', 'Gorilla', '大猩猩', '고릴라', 'Gorila', 320),
  ('Cheetah', 'cheetah', 'チーター', 'Cheetah', '猎豹', '치타', 'Guepardo', 330),
  ('Hippopotamus', 'hippopotamus', 'カバ', 'Hippopotamus', '河马', '하마', 'Hipopótamo', 340),
  ('Rhinoceros', 'rhinoceros', 'サイ', 'Rhinoceros', '犀牛', '코뿔소', 'Rinoceronte', 350),
  ('Camel', 'camel', 'ラクダ', 'Camel', '骆驼', '낙타', 'Camello', 360),
  ('Chimpanzee', 'chimpanzee', 'チンパンジー', 'Chimpanzee', '黑猩猩', '침팬지', 'Chimpancé', 370),
  ('Sloth', 'sloth', 'ナマケモノ', 'Sloth', '树懒', '나무늘보', 'Perezoso', 380),
  ('Alpaca', 'alpaca', 'アルパカ', 'Alpaca', '羊驼', '알파카', 'Alpaca', 390),
  ('Meerkat', 'meerkat', 'ミーアキャット', 'Meerkat', '猫鼬', '미어캣', 'Suricato', 400),
  ('Otter', 'otter', 'カワウソ', 'Otter', '水獭', '수달', 'Nutria', 410),
  ('Raccoon', 'raccoon', 'アライグマ', 'Raccoon', '浣熊', '너구리', 'Mapache', 420);
INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 207 FROM tags WHERE slug IN
  ('kangaroo','koala','gorilla','cheetah','hippopotamus','rhinoceros','camel','chimpanzee','sloth','alpaca','meerkat','otter','raccoon');
