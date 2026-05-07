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
  // 影響を受けたまま回復しないため、カスタムイベント駆動でリロードを回避する。
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))

  // 案 T: iOS PWA では OAuth 後に viewport が壊れる事象がある。
  // Google OAuth では「外部ドメイン経由で戻る」遷移により iOS が viewport を再計算するが、
  // LINE OAuth ではこの効果が得られない。
  // 対策: OAuth 完了直後に test-api.photlas.jp/api/v1/auth/viewport-bounce へ navigate して
  // 即 302 で test.photlas.jp/ に戻る経路を踏む。これにより SFSafariViewController が
  // 開いて即閉じる短いサイクルが発生し、iOS が viewport を再計算する効果を狙う。
  if (isPwaStandalone()) {
    window.location.href = `${API_V1_URL}/auth/viewport-bounce`
    return
  }

  // 通常ブラウザ: そのままホームへ遷移
  // Issue#104: URL パラメータ方式は廃止し、ホームに統一リダイレクト
  // 仮表示名／同意未済の判定は App.tsx のマウント時 /users/me チェックで行う（§4.18 / §4.14）
  navigate('/', { replace: true })
}

/** PWA standalone モード判定（iOS Safari の navigator.standalone と display-mode media query 両対応） */
function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true
  if (iosStandalone) return true
  if (typeof window.matchMedia !== 'function') return false
  // テスト環境では vi.resetAllMocks() で matchMedia の implementation が落ち、
  // undefined を返す場合があるため null guard を入れる。本番では常に MediaQueryList が返る。
  const mql = window.matchMedia('(display-mode: standalone)')
  return mql != null && mql.matches === true
}
