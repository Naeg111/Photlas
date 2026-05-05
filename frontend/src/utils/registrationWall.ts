/**
 * Issue#118: 登録壁（Registration Wall）の閲覧履歴管理ユーティリティ。
 *
 * 未ログインユーザーが写真詳細を閲覧した履歴を localStorage に蓄積し、
 * 一定件数（REGISTRATION_WALL_VIEW_LIMIT）に達したら登録壁を表示する。
 *
 * 設計方針は documents/04_Issues/Issue#118.md の 3.1 を参照。
 */

export const REGISTRATION_WALL_VIEW_LIMIT = 10
export const VIEWED_PHOTO_IDS_STORAGE_KEY = 'photlas_viewed_photo_ids'

const AUTH_TOKEN_STORAGE_KEY = 'auth_token'

/**
 * localStorage から閲覧済み写真ID リストを取得する。
 * 破損データ（不正な JSON、配列でない値、数値以外の要素）はフィルタして返す。
 * 例外発生時は空配列を返し、呼び出し元へ伝搬させない（堅牢性）。
 */
export function getViewedPhotoIds(): number[] {
  try {
    const raw = localStorage.getItem(VIEWED_PHOTO_IDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number')
  } catch {
    return []
  }
}

/**
 * 写真ID を閲覧履歴に追加する。
 * - 既に存在する ID は重複追加しない（冪等）
 * - REGISTRATION_WALL_VIEW_LIMIT 件で頭打ち
 * - localStorage 書き込み失敗時もクラッシュしない（堅牢性）
 */
export function addViewedPhotoId(id: number): void {
  try {
    const list = getViewedPhotoIds()
    if (list.includes(id)) return
    if (list.length >= REGISTRATION_WALL_VIEW_LIMIT) return
    list.push(id)
    localStorage.setItem(VIEWED_PHOTO_IDS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // 書き込み失敗時は何もしない（カウントが増えないだけで実害なし）
  }
}

/**
 * 閲覧履歴をクリアする（ログイン成功時に呼び出す）。
 * localStorage 書き込み失敗時もクラッシュしない（堅牢性）。
 */
export function clearViewedPhotoIds(): void {
  try {
    localStorage.removeItem(VIEWED_PHOTO_IDS_STORAGE_KEY)
  } catch {
    // 削除失敗時は何もしない
  }
}

/**
 * localStorage / sessionStorage に有効期限内の JWT が保存されているかを同期判定する。
 *
 * 用途: AuthContext の useEffect は初回レンダリング後に走るため、ログイン済みユーザーが
 *       リロードした際の初回レンダリング時点では isAuthenticated=false となる。
 *       本関数を shouldShowRegistrationWall 内で呼び出すことで、初回レンダリングでも
 *       「ログイン済み」と判定でき、登録壁のフリッカー（一瞬表示されてから消える）を防ぐ。
 *
 * 判定基準:
 *   - JWT の payload.exp（Unix 秒）が現在時刻より未来であれば有効
 *   - exp が無い、解析できない、いずれのストレージにも存在しないなら無効（保守的に未認証扱い）
 */
export function hasValidAuthToken(): boolean {
  try {
    const token =
      localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ??
      sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    if (!token) return false

    const payloadBase64 = token.split('.')[1]
    if (!payloadBase64) return false

    const payload = JSON.parse(atob(payloadBase64))
    if (typeof payload.exp !== 'number') return false

    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * 登録壁を表示すべきかを判定する。
 *
 * - ログイン中（React 側の状態）は常に false
 * - 未ログイン引数でも、localStorage に有効な JWT が残っていれば false（フリッカー防止）
 * - 閲覧履歴が REGISTRATION_WALL_VIEW_LIMIT 件以上なら true
 */
export function shouldShowRegistrationWall(isLoggedIn: boolean): boolean {
  if (isLoggedIn) return false
  if (hasValidAuthToken()) return false
  return getViewedPhotoIds().length >= REGISTRATION_WALL_VIEW_LIMIT
}
