import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { OAUTH_LOGIN_TOAST_FLAG_KEY } from '../config/app'

interface UseOAuthLoginToastParams {
  /** 利用規約同意ダイアログが表示中か */
  showTermsDialog: boolean
  /** ユーザー名登録ダイアログが表示中か */
  showUsernameDialog: boolean
  /** スプラッシュ画面が解除済みか */
  isSplashClosed: boolean
}

interface UseOAuthLoginToastResult {
  /**
   * /users/me 取得成功時に呼ぶ。OAuth ログイン操作直後（sessionStorage フラグあり）なら
   * フラグを消費して「ログインしました」トーストを保留状態にする。
   */
  beginIfOauthLogin: () => void
  /**
   * ログインが不成立になったとき（401 セッション切れ・規約キャンセル等）に呼ぶ。
   * 保留トーストと sessionStorage フラグを破棄する。
   */
  cancelPendingLoginToast: () => void
}

/**
 * Issue#144: OAuth ログイン操作完了時の「ログインしました」トースト発火を司るフック。
 *
 * <p>受動的な起動（再訪）と「OAuth ログイン操作直後」を区別するため、OAuthCallbackPage が
 * セットした sessionStorage フラグ（{@link OAUTH_LOGIN_TOAST_FLAG_KEY}）を真実の情報源とする。
 *
 * <p>発火は単一の useEffect に集約し、既存ユーザー（ダイアログ無し）／新規ユーザー
 * （規約 → ユーザー名）を分岐しない。「保留中 かつ オンボーディングのダイアログが全て閉じ
 * かつ スプラッシュ解除後」を満たした瞬間に 1 度だけ発火する。
 * {@code isSplashClosed} を条件に含めることで、
 * (1) スプラッシュ裏でトーストが消えるのを防ぎ、
 * (2) /users/me 取得の await をまたいだ中間レンダーでの早期発火も防ぐ。
 */
export function useOAuthLoginToast({
  showTermsDialog,
  showUsernameDialog,
  isSplashClosed,
}: UseOAuthLoginToastParams): UseOAuthLoginToastResult {
  const { t } = useTranslation()
  const [isPending, setIsPending] = useState(false)
  // React 18 Strict Mode の二重実行で同じトーストが2回出ないようにするガード。
  const firedRef = useRef(false)

  useEffect(() => {
    if (
      isPending &&
      !showTermsDialog &&
      !showUsernameDialog &&
      isSplashClosed &&
      !firedRef.current
    ) {
      firedRef.current = true
      setIsPending(false)
      toast(t('auth.loginSuccess'))
    }
  }, [isPending, showTermsDialog, showUsernameDialog, isSplashClosed, t])

  const beginIfOauthLogin = useCallback(() => {
    if (sessionStorage.getItem(OAUTH_LOGIN_TOAST_FLAG_KEY) === '1') {
      // フラグは成功時のみ消費する（5xx/ネットワークエラー時は残し、再試行成功で発火させる）
      sessionStorage.removeItem(OAUTH_LOGIN_TOAST_FLAG_KEY)
      setIsPending(true)
    }
  }, [])

  const cancelPendingLoginToast = useCallback(() => {
    sessionStorage.removeItem(OAUTH_LOGIN_TOAST_FLAG_KEY)
    setIsPending(false)
  }, [])

  return { beginIfOauthLogin, cancelPendingLoginToast }
}
