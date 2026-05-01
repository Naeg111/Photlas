/**
 * Issue#106: 国コード（ISO 3166-1 alpha-2）→ 中心座標・ズームレベルのマッピング
 *
 * IP国判定でユーザーの国が判明した際、その国の中心座標にマップをワープするために使用する。
 *
 * ズームレベルは国の面積に応じて 4〜8 の範囲で個別調整：
 * - 4: 極端に広い国（ロシア、カナダ、アメリカ、中国、オーストラリア、ブラジル等）
 * - 5: 中規模国家（基本値、既存の検索機能の国選択と同じ）
 * - 6: やや小さめの国
 * - 7-8: 都市国家・極小国（シンガポール、バチカン、モナコ等）
 */

export interface CountryCoordinate {
  lat: number
  lng: number
  zoom: number
}

export const COUNTRY_COORDINATES: Record<string, CountryCoordinate> = {
  // アジア
  JP: { lat: 36.2, lng: 138.3, zoom: 5 }, // 日本
  KR: { lat: 36.5, lng: 127.8, zoom: 6 }, // 韓国
  CN: { lat: 35.9, lng: 104.2, zoom: 4 }, // 中国
  TW: { lat: 23.7, lng: 121.0, zoom: 7 }, // 台湾
  HK: { lat: 22.3, lng: 114.2, zoom: 9 }, // 香港
  MO: { lat: 22.2, lng: 113.5, zoom: 11 }, // マカオ
  MN: { lat: 46.9, lng: 103.8, zoom: 4 }, // モンゴル
  KP: { lat: 40.3, lng: 127.5, zoom: 6 }, // 北朝鮮
  IN: { lat: 20.6, lng: 78.9, zoom: 4 }, // インド
  PK: { lat: 30.4, lng: 69.3, zoom: 5 }, // パキスタン
  BD: { lat: 23.7, lng: 90.4, zoom: 6 }, // バングラデシュ
  LK: { lat: 7.9, lng: 80.8, zoom: 7 }, // スリランカ
  NP: { lat: 28.4, lng: 84.1, zoom: 6 }, // ネパール
  BT: { lat: 27.5, lng: 90.4, zoom: 7 }, // ブータン
  MV: { lat: 3.2, lng: 73.2, zoom: 6 }, // モルディブ
  AF: { lat: 33.9, lng: 67.7, zoom: 5 }, // アフガニスタン
  // 東南アジア
  TH: { lat: 15.9, lng: 100.9, zoom: 5 }, // タイ
  VN: { lat: 14.1, lng: 108.3, zoom: 5 }, // ベトナム
  PH: { lat: 12.9, lng: 121.8, zoom: 5 }, // フィリピン
  MY: { lat: 4.2, lng: 101.9, zoom: 5 }, // マレーシア
  SG: { lat: 1.35, lng: 103.8, zoom: 10 }, // シンガポール
  ID: { lat: -0.8, lng: 113.9, zoom: 4 }, // インドネシア
  KH: { lat: 12.6, lng: 104.9, zoom: 6 }, // カンボジア
  LA: { lat: 19.9, lng: 102.5, zoom: 5 }, // ラオス
  MM: { lat: 21.9, lng: 95.9, zoom: 5 }, // ミャンマー
  BN: { lat: 4.5, lng: 114.7, zoom: 8 }, // ブルネイ
  TL: { lat: -8.9, lng: 125.7, zoom: 7 }, // 東ティモール
  // 中央アジア・コーカサス
  KZ: { lat: 48.0, lng: 66.9, zoom: 4 }, // カザフスタン
  UZ: { lat: 41.4, lng: 64.6, zoom: 5 }, // ウズベキスタン
  KG: { lat: 41.2, lng: 74.8, zoom: 6 }, // キルギス
  TJ: { lat: 38.9, lng: 71.3, zoom: 6 }, // タジキスタン
  TM: { lat: 38.97, lng: 59.6, zoom: 5 }, // トルクメニスタン
  AZ: { lat: 40.1, lng: 47.6, zoom: 6 }, // アゼルバイジャン
  AM: { lat: 40.1, lng: 45.0, zoom: 7 }, // アルメニア
  GE: { lat: 42.3, lng: 43.4, zoom: 6 }, // ジョージア
  // 中東
  AE: { lat: 23.4, lng: 53.8, zoom: 6 }, // UAE
  SA: { lat: 23.9, lng: 45.1, zoom: 5 }, // サウジアラビア
  IL: { lat: 31.0, lng: 34.9, zoom: 7 }, // イスラエル
  TR: { lat: 38.96, lng: 35.2, zoom: 5 }, // トルコ
  IR: { lat: 32.4, lng: 53.7, zoom: 5 }, // イラン
  IQ: { lat: 33.2, lng: 43.7, zoom: 5 }, // イラク
  SY: { lat: 34.8, lng: 38.9, zoom: 6 }, // シリア
  LB: { lat: 33.9, lng: 35.9, zoom: 8 }, // レバノン
  JO: { lat: 30.6, lng: 36.2, zoom: 6 }, // ヨルダン
  KW: { lat: 29.3, lng: 47.5, zoom: 7 }, // クウェート
  QA: { lat: 25.4, lng: 51.2, zoom: 8 }, // カタール
  BH: { lat: 26.0, lng: 50.6, zoom: 9 }, // バーレーン
  OM: { lat: 21.5, lng: 55.9, zoom: 5 }, // オマーン
  YE: { lat: 15.5, lng: 48.5, zoom: 5 }, // イエメン
  PS: { lat: 31.9, lng: 35.2, zoom: 7 }, // パレスチナ
  // ヨーロッパ
  GB: { lat: 54.0, lng: -2.0, zoom: 5 }, // イギリス
  IE: { lat: 53.4, lng: -8.2, zoom: 6 }, // アイルランド
  FR: { lat: 46.6, lng: 2.2, zoom: 5 }, // フランス
  DE: { lat: 51.2, lng: 10.4, zoom: 5 }, // ドイツ
  IT: { lat: 41.9, lng: 12.6, zoom: 5 }, // イタリア
  ES: { lat: 40.5, lng: -3.7, zoom: 5 }, // スペイン
  PT: { lat: 39.4, lng: -8.2, zoom: 6 }, // ポルトガル
  NL: { lat: 52.1, lng: 5.3, zoom: 7 }, // オランダ
  BE: { lat: 50.5, lng: 4.5, zoom: 7 }, // ベルギー
  CH: { lat: 46.8, lng: 8.2, zoom: 7 }, // スイス
  AT: { lat: 47.5, lng: 14.6, zoom: 7 }, // オーストリア
  LU: { lat: 49.8, lng: 6.1, zoom: 9 }, // ルクセンブルク
  MC: { lat: 43.7, lng: 7.4, zoom: 13 }, // モナコ
  LI: { lat: 47.2, lng: 9.6, zoom: 11 }, // リヒテンシュタイン
  AD: { lat: 42.5, lng: 1.6, zoom: 10 }, // アンドラ
  SM: { lat: 43.9, lng: 12.5, zoom: 11 }, // サンマリノ
  VA: { lat: 41.9, lng: 12.5, zoom: 14 }, // バチカン
  MT: { lat: 35.9, lng: 14.4, zoom: 10 }, // マルタ
  // 北欧
  SE: { lat: 60.1, lng: 18.6, zoom: 4 }, // スウェーデン
  NO: { lat: 60.5, lng: 8.5, zoom: 4 }, // ノルウェー
  FI: { lat: 61.9, lng: 25.7, zoom: 5 }, // フィンランド
  DK: { lat: 56.3, lng: 9.5, zoom: 6 }, // デンマーク
  IS: { lat: 64.96, lng: -19.0, zoom: 6 }, // アイスランド
  // 東欧
  PL: { lat: 51.9, lng: 19.1, zoom: 5 }, // ポーランド
  CZ: { lat: 49.8, lng: 15.5, zoom: 6 }, // チェコ
  SK: { lat: 48.7, lng: 19.7, zoom: 7 }, // スロバキア
  HU: { lat: 47.2, lng: 19.5, zoom: 6 }, // ハンガリー
  RO: { lat: 45.9, lng: 24.97, zoom: 6 }, // ルーマニア
  BG: { lat: 42.7, lng: 25.5, zoom: 6 }, // ブルガリア
  GR: { lat: 39.1, lng: 21.8, zoom: 6 }, // ギリシャ
  HR: { lat: 45.1, lng: 15.2, zoom: 6 }, // クロアチア
  RS: { lat: 44.0, lng: 21.0, zoom: 6 }, // セルビア
  SI: { lat: 46.2, lng: 14.99, zoom: 7 }, // スロベニア
  BA: { lat: 43.9, lng: 17.7, zoom: 7 }, // ボスニア・ヘルツェゴビナ
  ME: { lat: 42.7, lng: 19.4, zoom: 7 }, // モンテネグロ
  MK: { lat: 41.6, lng: 21.7, zoom: 7 }, // 北マケドニア
  AL: { lat: 41.2, lng: 20.2, zoom: 7 }, // アルバニア
  XK: { lat: 42.6, lng: 20.9, zoom: 8 }, // コソボ
  // 旧ソ連圏
  RU: { lat: 61.5, lng: 105.3, zoom: 3 }, // ロシア
  UA: { lat: 48.4, lng: 31.2, zoom: 5 }, // ウクライナ
  BY: { lat: 53.7, lng: 27.95, zoom: 6 }, // ベラルーシ
  MD: { lat: 47.4, lng: 28.4, zoom: 7 }, // モルドバ
  EE: { lat: 58.6, lng: 25.0, zoom: 7 }, // エストニア
  LV: { lat: 56.9, lng: 24.6, zoom: 7 }, // ラトビア
  LT: { lat: 55.2, lng: 23.9, zoom: 7 }, // リトアニア
  CY: { lat: 35.1, lng: 33.4, zoom: 8 }, // キプロス
  // 北米
  US: { lat: 39.8, lng: -98.6, zoom: 4 }, // アメリカ
  CA: { lat: 56.1, lng: -106.3, zoom: 3 }, // カナダ
  MX: { lat: 23.6, lng: -102.6, zoom: 5 }, // メキシコ
  // 中米・カリブ海
  CU: { lat: 21.5, lng: -77.8, zoom: 6 }, // キューバ
  GT: { lat: 15.8, lng: -90.2, zoom: 7 }, // グアテマラ
  HN: { lat: 15.2, lng: -86.2, zoom: 7 }, // ホンジュラス
  SV: { lat: 13.8, lng: -88.9, zoom: 8 }, // エルサルバドル
  NI: { lat: 12.9, lng: -85.2, zoom: 7 }, // ニカラグア
  CR: { lat: 9.7, lng: -83.8, zoom: 8 }, // コスタリカ
  PA: { lat: 8.5, lng: -80.8, zoom: 7 }, // パナマ
  BZ: { lat: 17.2, lng: -88.5, zoom: 8 }, // ベリーズ
  JM: { lat: 18.1, lng: -77.3, zoom: 9 }, // ジャマイカ
  HT: { lat: 18.9, lng: -72.3, zoom: 8 }, // ハイチ
  DO: { lat: 18.7, lng: -70.2, zoom: 8 }, // ドミニカ共和国
  PR: { lat: 18.2, lng: -66.6, zoom: 9 }, // プエルトリコ
  TT: { lat: 10.7, lng: -61.2, zoom: 9 }, // トリニダード・トバゴ
  BB: { lat: 13.2, lng: -59.5, zoom: 11 }, // バルバドス
  BS: { lat: 25.0, lng: -77.4, zoom: 7 }, // バハマ
  // 南米
  BR: { lat: -14.2, lng: -51.9, zoom: 4 }, // ブラジル
  AR: { lat: -38.4, lng: -63.6, zoom: 4 }, // アルゼンチン
  CL: { lat: -35.7, lng: -71.5, zoom: 4 }, // チリ
  CO: { lat: 4.6, lng: -74.3, zoom: 5 }, // コロンビア
  PE: { lat: -9.2, lng: -75.0, zoom: 5 }, // ペルー
  VE: { lat: 6.4, lng: -66.6, zoom: 5 }, // ベネズエラ
  EC: { lat: -1.8, lng: -78.2, zoom: 6 }, // エクアドル
  BO: { lat: -16.3, lng: -63.6, zoom: 5 }, // ボリビア
  PY: { lat: -23.4, lng: -58.4, zoom: 6 }, // パラグアイ
  UY: { lat: -32.5, lng: -55.8, zoom: 6 }, // ウルグアイ
  GY: { lat: 4.9, lng: -58.9, zoom: 6 }, // ガイアナ
  SR: { lat: 3.9, lng: -56.0, zoom: 6 }, // スリナム
  GF: { lat: 3.9, lng: -53.1, zoom: 6 }, // フランス領ギアナ
  // オセアニア
  AU: { lat: -25.3, lng: 133.8, zoom: 4 }, // オーストラリア
  NZ: { lat: -40.9, lng: 174.9, zoom: 5 }, // ニュージーランド
  PG: { lat: -6.3, lng: 143.95, zoom: 6 }, // パプアニューギニア
  FJ: { lat: -17.7, lng: 178.1, zoom: 7 }, // フィジー
  SB: { lat: -9.6, lng: 160.2, zoom: 6 }, // ソロモン諸島
  VU: { lat: -15.4, lng: 166.96, zoom: 7 }, // バヌアツ
  NC: { lat: -20.9, lng: 165.6, zoom: 7 }, // ニューカレドニア
  PF: { lat: -17.7, lng: -149.4, zoom: 7 }, // 仏領ポリネシア
  WS: { lat: -13.8, lng: -172.1, zoom: 9 }, // サモア
  TO: { lat: -21.2, lng: -175.2, zoom: 9 }, // トンガ
  KI: { lat: 1.9, lng: -157.4, zoom: 6 }, // キリバス
  // アフリカ - 北部
  EG: { lat: 26.8, lng: 30.8, zoom: 5 }, // エジプト
  LY: { lat: 26.3, lng: 17.2, zoom: 5 }, // リビア
  TN: { lat: 33.9, lng: 9.5, zoom: 6 }, // チュニジア
  DZ: { lat: 28.0, lng: 1.7, zoom: 4 }, // アルジェリア
  MA: { lat: 31.8, lng: -7.1, zoom: 5 }, // モロッコ
  SD: { lat: 12.9, lng: 30.2, zoom: 5 }, // スーダン
  SS: { lat: 6.9, lng: 31.3, zoom: 6 }, // 南スーダン
  // アフリカ - 西部
  NG: { lat: 9.1, lng: 8.7, zoom: 5 }, // ナイジェリア
  GH: { lat: 7.95, lng: -1.0, zoom: 6 }, // ガーナ
  CI: { lat: 7.5, lng: -5.5, zoom: 6 }, // コートジボワール
  SN: { lat: 14.5, lng: -14.5, zoom: 6 }, // セネガル
  ML: { lat: 17.6, lng: -3.996, zoom: 5 }, // マリ
  BF: { lat: 12.2, lng: -1.6, zoom: 6 }, // ブルキナファソ
  NE: { lat: 17.6, lng: 8.1, zoom: 5 }, // ニジェール
  GN: { lat: 9.95, lng: -9.7, zoom: 6 }, // ギニア
  BJ: { lat: 9.3, lng: 2.3, zoom: 6 }, // ベナン
  TG: { lat: 8.6, lng: 0.8, zoom: 6 }, // トーゴ
  SL: { lat: 8.5, lng: -11.8, zoom: 7 }, // シエラレオネ
  LR: { lat: 6.4, lng: -9.4, zoom: 7 }, // リベリア
  MR: { lat: 21.0, lng: -10.9, zoom: 5 }, // モーリタニア
  GM: { lat: 13.4, lng: -15.3, zoom: 8 }, // ガンビア
  CV: { lat: 16.0, lng: -24.0, zoom: 8 }, // カーボベルデ
  // アフリカ - 中部
  CD: { lat: -4.0, lng: 21.8, zoom: 4 }, // コンゴ民主共和国
  CG: { lat: -0.2, lng: 15.8, zoom: 5 }, // コンゴ共和国
  CM: { lat: 7.4, lng: 12.3, zoom: 5 }, // カメルーン
  CF: { lat: 6.6, lng: 20.9, zoom: 5 }, // 中央アフリカ
  TD: { lat: 15.5, lng: 18.7, zoom: 5 }, // チャド
  GA: { lat: -0.8, lng: 11.6, zoom: 6 }, // ガボン
  GQ: { lat: 1.6, lng: 10.3, zoom: 7 }, // 赤道ギニア
  // アフリカ - 東部
  KE: { lat: -0.02, lng: 37.9, zoom: 6 }, // ケニア
  TZ: { lat: -6.4, lng: 34.9, zoom: 5 }, // タンザニア
  UG: { lat: 1.4, lng: 32.3, zoom: 6 }, // ウガンダ
  ET: { lat: 9.1, lng: 40.5, zoom: 5 }, // エチオピア
  SO: { lat: 5.2, lng: 46.2, zoom: 5 }, // ソマリア
  RW: { lat: -2.0, lng: 29.9, zoom: 8 }, // ルワンダ
  BI: { lat: -3.4, lng: 29.9, zoom: 8 }, // ブルンジ
  ER: { lat: 15.2, lng: 39.8, zoom: 6 }, // エリトリア
  DJ: { lat: 11.8, lng: 42.6, zoom: 8 }, // ジブチ
  MG: { lat: -18.8, lng: 47.0, zoom: 5 }, // マダガスカル
  MU: { lat: -20.3, lng: 57.6, zoom: 9 }, // モーリシャス
  SC: { lat: -4.7, lng: 55.5, zoom: 9 }, // セーシェル
  KM: { lat: -11.9, lng: 43.9, zoom: 8 }, // コモロ
  // アフリカ - 南部
  ZA: { lat: -30.6, lng: 22.9, zoom: 5 }, // 南アフリカ
  ZW: { lat: -19.0, lng: 29.97, zoom: 6 }, // ジンバブエ
  ZM: { lat: -13.1, lng: 27.85, zoom: 5 }, // ザンビア
  MZ: { lat: -18.7, lng: 35.5, zoom: 5 }, // モザンビーク
  AO: { lat: -11.2, lng: 17.9, zoom: 5 }, // アンゴラ
  BW: { lat: -22.3, lng: 24.7, zoom: 5 }, // ボツワナ
  NA: { lat: -22.96, lng: 18.5, zoom: 5 }, // ナミビア
  MW: { lat: -13.3, lng: 34.3, zoom: 6 }, // マラウイ
  LS: { lat: -29.6, lng: 28.2, zoom: 7 }, // レソト
  SZ: { lat: -26.5, lng: 31.5, zoom: 8 }, // エスワティニ
}

/**
 * 国コードに対応する座標情報を取得する。
 * 存在しない国コード、null、空文字に対しては undefined を返す。
 */
export function getCountryCoordinates(countryCode: string | null | undefined): CountryCoordinate | undefined {
  if (!countryCode) return undefined
  return COUNTRY_COORDINATES[countryCode]
}
