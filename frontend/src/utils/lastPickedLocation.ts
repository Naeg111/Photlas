/**
 * Issue#158: 投稿ダイアログで「ユーザーが能動的に選んだ前回位置」を保持する。
 *
 * `lastGeolocationCache.ts`（localStorage・24h TTL・ブラウザ位置情報用）とは用途が別。
 * こちらは **セッション内メモリのみ**（モジュールレベル変数）で保持し、localStorage は使わない。
 * そのためページ再読み込み・ブラウザ再起動で消える（＝そのタブを開いている間だけ有効）。
 *
 * 投稿ダイアログを閉じるとき（アンマウント時）に、ユーザーが検索/ドラッグ/現在地ボタンで
 * 能動的に選んだ最後の位置を保存し、次に開いた（GPS の無い写真の）ときの初期ピンに使う。
 */

interface Location {
  lat: number
  lng: number
}

let lastPicked: Location | null = null

/**
 * 記憶している前回選択位置を返す。未設定なら null。
 * 内部状態を保護するためコピーを返す。
 */
export function getLastPickedLocation(): Location | null {
  return lastPicked ? { lat: lastPicked.lat, lng: lastPicked.lng } : null
}

/**
 * 前回選択位置を保存する（最新の値で上書き）。
 */
export function setLastPickedLocation(location: Location): void {
  lastPicked = { lat: location.lat, lng: location.lng }
}

/**
 * 記憶をクリアする（主にテストの初期化用）。
 */
export function clearLastPickedLocation(): void {
  lastPicked = null
}
