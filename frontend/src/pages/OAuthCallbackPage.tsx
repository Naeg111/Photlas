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
 * iOS PWA で OAuth 戻り後の viewport 不整合を強制的に回復させる試み（H 改 D）。
 *
 * 過去の試行で viewport.content を空にして戻す方式は viewport-fit=cover の効果が
 * 復元されず、UI 全体が下にズレる症状を起こしたため、initial-scale だけを一瞬変えて
 * 元に戻す方式に変更した（viewport-fit=cover は常時維持される）。
 *
 * 1. 3 秒待機して SFSafariViewController が完全に dispose されるのを待つ
 * 2. viewport meta タグの initial-scale を 0.999999 → 1.0 にトグル（iOS に viewport 再評価を促す）
 * 3. resize イベントを dispatch
 * 4. window.scrollTo(0, 0) でスクロール位置を強制リセット（vertical shift 対策）
 *
 * デバイス回転で治ることが報告されている事象を JS で代替的にトリガーする狙い。
 * 効く保証はなく、効かなければユーザー案内（タスクキル誘導）に倒すしかない。
 */
async function runAggressiveViewportRecalc(): Promise<void> {
  // 3 秒待機: SFSafariViewController dispose を確実に
  await sleep(3000)

  // viewport meta の initial-scale を一瞬変えて戻す。
  // viewport-fit=cover を維持するため content 全体を空にはせず、initial-scale 部分のみ書き換える。
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  if (viewport) {
    const original = viewport.content
    const scrambled = original.replace(/initial-scale=[^,\s]+/, 'initial-scale=0.999999')
    if (scrambled !== original) {
      viewport.content = scrambled
      await nextFrame()
      viewport.content = original
      await nextFrame()
    }
  }

  // resize イベントを dispatch して各種リスナーに viewport 変化を通知
  window.dispatchEvent(new Event('resize'))

  // 念のためスクロール位置をトップに戻す（WKWebView 内部スクロールがズレている場合に回復）
  window.scrollTo(0, 0)
  document.scrollingElement?.scrollTo(0, 0)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()))
}
