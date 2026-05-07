import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_CHANGED_EVENT } from '../contexts/AuthContext'

/**
 * Issue#81 Phase 5a - OAuth コールバックページ。
 *
 * バックエンドの OAuth2LoginSuccessHandler / OAuth2LoginFailureHandler から
 * `/oauth/callback#...` にリダイレクトされてくる。
 *
 * フラグメント形式:
 *   - 成功:          #access_token=<jwt>
 *   - 仮表示名:  #access_token=<jwt>&requires_username_setup=true
 *   - 失敗:          #error=<code>
 *   - 既存紐付け確認: #link_confirmation_token=<token>&provider=<GOOGLE|LINE>
 *
 * React Strict Mode の二重マウント対策で {@code processedRef} を使う。
 */
export default function OAuthCallbackPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const processedRef = useRef(false)

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true

    const params = parseFragment(window.location.hash)

    // エラー分岐
    const errorCode = params.get('error')
    if (errorCode) {
      setStatus('error')
      setErrorMessage(resolveErrorMessage(errorCode, t))
      return
    }

    // リンク確認フロー: 既存アカウントとの紐付け確認
    const linkToken = params.get('link_confirmation_token')
    if (linkToken) {
      const provider = params.get('provider') || ''
      // ルートに移動し、state で LinkAccountConfirmDialog に渡す
      navigate('/', {
        replace: true,
        state: { linkConfirmationToken: linkToken, provider },
      })
      return
    }

    // 成功: access_token
    const accessToken = params.get('access_token')
    if (accessToken) {
      // Issue#104: requires_username_setup の URL パラメータは廃止（/users/me のサーバー応答を真実の情報源とする）
      completeLogin(accessToken, navigate).catch(() => {
        setStatus('error')
        setErrorMessage(t('auth.errorOccurred'))
      })
      return
    }

    // その他（フラグメント無しや未知の形式）
    setStatus('error')
    setErrorMessage(t('auth.errorOccurred'))
  }, [navigate, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div
              role="status"
              aria-label={t('pages.oauthCallbackProcessing')}
              className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"
            />
            <p className="text-gray-600">{t('pages.oauthCallbackProcessing')}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">&#10007;</div>
            <h2 className="text-xl font-bold mb-2">{t('pages.oauthCallbackError')}</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 text-primary hover:underline"
            >
              {t('common.home')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** フラグメント（#...）を URLSearchParams 相当に解析する。 */
function parseFragment(hash: string): URLSearchParams {
  const raw = hash.startsWith('#') ? hash.substring(1) : hash
  return new URLSearchParams(raw)
}

/**
 * エラーコードを i18n メッセージに変換する。未知のコードは汎用メッセージにフォールバック。
 */
function resolveErrorMessage(code: string, t: (key: string) => string): string {
  const key = `auth.oauth.errors.${code}`
  const translated = t(key)
  // i18next は未定義キーの場合キー自身を返す
  if (translated === key) {
    return t('auth.oauth.errors.OAUTH_UNKNOWN_ERROR')
  }
  return translated
}

/**
 * JWT を使って /users/me からユーザー情報を取得し、AuthContext にログインさせてリダイレクトする。
 *
 * <p>AuthContext の login は User オブジェクトを要求するため、JWT だけでは足りず
 * バックエンド /users/me で完全な User 情報を取得する。
 */
async function completeLogin(
  accessToken: string,
  navigate: (path: string, opts?: { replace?: boolean; state?: unknown }) => void
): Promise<void> {
  const { API_V1_URL } = await import('../config/api')

  const response = await fetch(`${API_V1_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new Error(`failed to fetch user profile: ${response.status}`)
  }
  const userData = await response.json()

  // localStorage / sessionStorage への書き込みは AuthProvider の login で一元管理できるが、
  // OAuth ログインは常に remember=true（localStorage）で保持する設計
  // AuthContext を useAuth 経由で呼ぶため、下記の DOM イベント経由で親に通知する方法を採る:
  //   dispatchEvent で Custom Event を投げ、MainApp 側で useAuth().login を呼ぶ
  // ただし、直接 AuthContext を呼ぶ方がシンプルなので、ここでは一旦 localStorage に直接書く
  // （AuthProvider の useEffect が起動時に拾う想定）
  localStorage.setItem('auth_token', accessToken)
  localStorage.setItem('auth_user', JSON.stringify({
    userId: userData.userId,
    username: userData.username,
    email: userData.email,
    role: userData.role,
    language: userData.language,
  }))

  // AuthProvider にストレージ更新を通知して state を再読させる。
  // 過去は window.location.reload() で AuthProvider の初回 useEffect を再走させていたが、
  // iOS PWA では reload しても WKWebView の viewport state が SFSafariViewController の
  // 影響を受けたまま回復しない（→画面下が home indicator 裏に隠れる）。
  // カスタムイベント駆動にすることで reload を回避し、React の自然な再レンダリングで
  // iOS の viewport 状態が回復することを期待する。
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))

  // Issue#104: URL パラメータ方式は廃止し、ホームに統一リダイレクト
  // 仮表示名／同意未済の判定は App.tsx のマウント時 /users/me チェックで行う（§4.18 / §4.14）
  navigate('/', { replace: true })

  // PWA のみ: イベント駆動だけでは iOS WebKit の viewport 計算が回復しない場合に備えて、
  // バックグラウンドで viewport の強制再計算を試みる。画面遷移はすでに完了しているため
  // この処理はメイン UX をブロックしない。
  if (isPwaStandalone()) {
    void runAggressiveViewportRecalc()
  }
}

/** PWA standalone モード判定（iOS Safari の navigator.standalone と display-mode media query 両対応） */
function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  if (iosStandalone) return true
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

/**
 * iOS PWA で OAuth 戻り後の viewport 不整合を強制的に回復させる試み（案 O Phase 1）。
 *
 * デバイス物理回転で治ることが業界で報告されている事象を、Screen Orientation API で
 * プログラム的に再現する試み。横向きにロック → 縦向きにロック → 解除を行う。
 * iOS PWA で API がサポートされていれば、物理回転と同じ効果で iOS WebKit の
 * viewport 計算がリセットされる。
 *
 * 注意: この Phase では UX 上「画面が一瞬回転する」のがそのまま見える。
 * 効果が確認できたら Phase 2 でローディングオーバーレイで視覚的に隠す。
 *
 * 補助として resize イベント発火と scroll リセットも行う。
 */
async function runAggressiveViewportRecalc(): Promise<void> {
  // 3 秒待機: SFSafariViewController dispose を確実に
  await sleep(3000)

  // メイン手段: Screen Orientation API で擬似的な物理回転を発火
  await tryRotateForViewportRecalc()

  // 補助: resize イベント発火 + スクロール位置リセット
  window.dispatchEvent(new Event('resize'))
  window.scrollTo(0, 0)
  document.scrollingElement?.scrollTo(0, 0)
}

/**
 * Screen Orientation API でデバイスを横向き → 縦向きに切り替えて viewport 計算をリセットする。
 *
 * iOS Safari の API サポートは限定的だが、PWA standalone モードなら動作する可能性がある。
 * API が存在しない、または fullscreen 必須等の理由で拒否された場合は静かに無視する。
 */
async function tryRotateForViewportRecalc(): Promise<void> {
  if (typeof screen === 'undefined') return
  // OrientationLockType は TS lib バージョンによっては未定義のため、文字列リテラル union を直接記述する。
  type LockMode = 'any' | 'natural' | 'landscape' | 'portrait'
    | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary'
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (mode: LockMode) => Promise<void>
    unlock?: () => void
  }
  if (!orientation || typeof orientation.lock !== 'function') return

  try {
    // 横向きへロック（実際にデバイス画面が回転する）
    await orientation.lock('landscape-primary')
    await sleep(500)
    // 縦向きへロック（戻す）
    await orientation.lock('portrait-primary')
    await sleep(100)
    // ロック解除して manifest の orientation: any に従う状態に戻す
    if (typeof orientation.unlock === 'function') {
      orientation.unlock()
    }
  } catch {
    // API 未サポート / fullscreen 必須拒否 / マニフェスト設定との不整合 等は無視
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
