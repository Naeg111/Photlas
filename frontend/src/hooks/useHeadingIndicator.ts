import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Issue#115: 方角インジケーター用カスタムフック
 *
 * 役割：
 * - ON/OFF 状態を localStorage に永続化
 * - ON のときだけ deviceorientation 系イベントを購読
 * - iOS (webkitCompassHeading) / Android (alpha) のプラットフォーム差異を吸収
 * - 取得した heading をローパスフィルタで平滑化、requestAnimationFrame でスロットリング
 *
 * iOS の許可リクエストは Phase4 で setEnabled に統合する（現段階では非iOS パスのみ）。
 */
export const HEADING_INDICATOR_STORAGE_KEY = 'photlas_heading_indicator_enabled'
/**
 * 初期化マーカー。値の有無で「このユーザーが初期化済か」を判別する。
 * 既存ユーザーの localStorage には旧 STORAGE_KEY が "true" のまま残っている可能性があるため、
 * このマーカーが無い場合は強制的に OFF 化（旧値を削除）してからマーカーを立てる。
 */
export const HEADING_INDICATOR_INIT_KEY_V2 = 'photlas_heading_indicator_initialized_v2'

/** ローパスフィルタ（前回値と新規値を平滑化） */
const LOW_PASS_PREV_WEIGHT = 0.8
const LOW_PASS_NEW_WEIGHT = 0.2

interface OrientationEventLike extends Event {
  webkitCompassHeading?: number
  alpha?: number | null
  absolute?: boolean
}

/** setEnabled の戻り値。呼び出し元はトースト表示などに使う */
export interface SetHeadingEnabledResult {
  /** OS の方角センサー許可が得られたか（OFF→指定時のみ意味を持つ。OFF 化時は常に true） */
  granted: boolean
}

interface UseHeadingIndicatorReturn {
  /** トグルの ON/OFF 状態 */
  enabled: boolean
  /** 現在の方角（度数、0=北、時計回り）。未取得時は null */
  heading: number | null
  /** ON/OFF を切り替える。iOS では ON 化時に OS の方角センサー許可をリクエストする */
  setEnabled: (next: boolean) => Promise<SetHeadingEnabledResult>
}

/**
 * 受信したイベントから時計回りの方角（0=北）を抽出する。
 * iOS は webkitCompassHeading を時計回りでそのまま利用。
 * Android (deviceorientationabsolute, absolute=true) は alpha が反時計回りなので変換する。
 */
function extractHeading(event: OrientationEventLike): number | null {
  if (typeof event.webkitCompassHeading === 'number') {
    return event.webkitCompassHeading
  }
  if (event.absolute && typeof event.alpha === 'number') {
    return (360 - event.alpha) % 360
  }
  return null
}

function readInitialEnabled(): boolean {
  try {
    if (localStorage.getItem(HEADING_INDICATOR_INIT_KEY_V2) !== 'true') {
      // 初回起動（または旧バージョンからの初回アクセス）: 旧 enabled 値をクリアして強制 OFF
      localStorage.removeItem(HEADING_INDICATOR_STORAGE_KEY)
      localStorage.setItem(HEADING_INDICATOR_INIT_KEY_V2, 'true')
      return false
    }
    return localStorage.getItem(HEADING_INDICATOR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** localStorage に enabled 値を書き込む。プライベートブラウズ等の失敗は無視する */
function writeEnabledToStorage(value: boolean): void {
  try {
    localStorage.setItem(HEADING_INDICATOR_STORAGE_KEY, String(value))
  } catch {
    /* noop */
  }
}

/**
 * Issue#115 §4: 方角センサーが利用可能と推定できるかを判定する。
 *
 * 厳密な「センサー有無」は Web 標準で取得できない（Permissions API も geolocation 等のみ）ため、
 * `(any-pointer: coarse)` メディアクエリで「タッチ操作可能なデバイス（モバイル/タブレット）」かを
 * 確認する近似判定を採用する。スマートフォン/タブレットは通常センサーを持つ。
 *
 * matchMedia 非対応環境では true を返す（不明なら有効寄り、ユーザーが OFF にできる）。
 */
export function isHeadingIndicatorAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(any-pointer: coarse)').matches
}

/**
 * iOS 13+ の DeviceOrientationEvent.requestPermission を呼んで結果を返す。
 * 関数が存在しない（非iOS / 旧バージョン）場合は granted 扱い。
 */
async function requestOrientationPermission(): Promise<boolean> {
  const ctor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied' | 'default'>
  }
  if (typeof ctor.requestPermission !== 'function') return true
  try {
    const result = await ctor.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

export function useHeadingIndicator(): UseHeadingIndicatorReturn {
  const [enabled, setEnabledState] = useState<boolean>(readInitialEnabled)
  const [heading, setHeading] = useState<number | null>(null)
  // 最新の heading（ローパスフィルタの前回値）。state とは別に ref で保持して RAF コールバックから読む
  const smoothedRef = useRef<number | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const pendingRawRef = useRef<number | null>(null)

  const flushHeading = useCallback(() => {
    rafIdRef.current = null
    const raw = pendingRawRef.current
    pendingRawRef.current = null
    if (raw === null) return

    const prev = smoothedRef.current
    const next = prev === null
      ? raw
      : prev * LOW_PASS_PREV_WEIGHT + raw * LOW_PASS_NEW_WEIGHT
    smoothedRef.current = next
    setHeading(next)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handler = (event: Event) => {
      const value = extractHeading(event as OrientationEventLike)
      if (value === null) return
      pendingRawRef.current = value
      if (rafIdRef.current !== null) return
      // requestAnimationFrame が無い環境（古いjsdomなど）では即座に flush
      if (typeof window.requestAnimationFrame === 'function') {
        rafIdRef.current = window.requestAnimationFrame(flushHeading)
      } else {
        flushHeading()
      }
    }

    window.addEventListener('deviceorientationabsolute', handler)
    window.addEventListener('deviceorientation', handler)

    return () => {
      window.removeEventListener('deviceorientationabsolute', handler)
      window.removeEventListener('deviceorientation', handler)
      if (rafIdRef.current !== null && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      pendingRawRef.current = null
      // OFF 時は heading を初期化（次回 ON 時に古い値が一瞬表示されるのを防ぐ）
      smoothedRef.current = null
      setHeading(null)
    }
  }, [enabled, flushHeading])

  const setEnabled = useCallback(async (next: boolean): Promise<SetHeadingEnabledResult> => {
    if (next) {
      // ON 化時のみ OS 許可を確認。iOS では拒否された場合は OFF に戻す。
      const granted = await requestOrientationPermission()
      if (!granted) {
        setEnabledState(false)
        writeEnabledToStorage(false)
        return { granted: false }
      }
    }
    setEnabledState(next)
    writeEnabledToStorage(next)
    return { granted: true }
  }, [])

  return { enabled, heading, setEnabled }
}
