import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useHeadingIndicator, HEADING_INDICATOR_STORAGE_KEY, isHeadingIndicatorAvailable } from './useHeadingIndicator'

/**
 * Issue#115: 方角インジケーターのフックテスト
 * Phase1 Red段階: sessionStorage 連携 + ON/OFF 状態 + リスナー登録/解除
 *
 * iOS 許可フローは Phase4 で別途追加するため本テストでは扱わない
 * （DeviceOrientationEvent.requestPermission は未定義として扱われる = 非iOS パス）
 */
describe('useHeadingIndicator', () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>
  let rafSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    // sessionStorage のモックは setup.ts で global に設定されている
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    // RAF を同期実行に差し替え（テスト中の状態反映を act() 完了時に確定させるため）
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(performance.now())
      return 0
    })
  })

  afterEach(() => {
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    rafSpy.mockRestore()
  })

  describe('初期状態', () => {
    it('sessionStorage に値がない場合、enabled は false', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const { result } = renderHook(() => useHeadingIndicator())
      expect(result.current.enabled).toBe(false)
    })

    it('sessionStorage に "true" が保存されている場合、enabled は true', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())
      expect(result.current.enabled).toBe(true)
    })

    it('sessionStorage に "false" が保存されている場合、enabled は false', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('false')
      const { result } = renderHook(() => useHeadingIndicator())
      expect(result.current.enabled).toBe(false)
    })

    it('sessionStorage キーは photlas_heading_indicator_enabled', () => {
      expect(HEADING_INDICATOR_STORAGE_KEY).toBe('photlas_heading_indicator_enabled')
    })

    it('初期状態の heading は null', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const { result } = renderHook(() => useHeadingIndicator())
      expect(result.current.heading).toBeNull()
    })
  })

  describe('setEnabled でトグル', () => {
    it('setEnabled(true) で enabled が true になる', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(true) })

      expect(result.current.enabled).toBe(true)
    })

    it('setEnabled(true) で sessionStorage に "true" が保存される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(true) })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        HEADING_INDICATOR_STORAGE_KEY,
        'true'
      )
    })

    it('setEnabled(false) で sessionStorage に "false" が保存される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(false) })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        HEADING_INDICATOR_STORAGE_KEY,
        'false'
      )
    })
  })

  describe('リスナー登録/解除', () => {
    it('enabled=true になると deviceorientation 系イベントリスナーが登録される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(true) })

      const orientationListenerCalls = addEventListenerSpy.mock.calls.filter(
        ([eventName]) => eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute'
      )
      expect(orientationListenerCalls.length).toBeGreaterThan(0)
    })

    it('enabled=true から false に切り替えるとリスナーが解除される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(false) })

      const removeCalls = removeEventListenerSpy.mock.calls.filter(
        ([eventName]) => eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute'
      )
      expect(removeCalls.length).toBeGreaterThan(0)
    })

    it('unmount 時にリスナーが解除される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { unmount } = renderHook(() => useHeadingIndicator())

      unmount()

      const removeCalls = removeEventListenerSpy.mock.calls.filter(
        ([eventName]) => eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute'
      )
      expect(removeCalls.length).toBeGreaterThan(0)
    })

    it('enabled=false の状態ではリスナーは登録されない', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      renderHook(() => useHeadingIndicator())

      const orientationListenerCalls = addEventListenerSpy.mock.calls.filter(
        ([eventName]) => eventName === 'deviceorientation' || eventName === 'deviceorientationabsolute'
      )
      expect(orientationListenerCalls.length).toBe(0)
    })
  })

  describe('heading の更新', () => {
    it('webkitCompassHeading 付きイベント（iOS 形式）で heading が更新される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())

      // フックがリスナーを登録するのを待つ
      await act(async () => {
        const event = new Event('deviceorientation') as Event & { webkitCompassHeading?: number; alpha?: number; absolute?: boolean }
        event.webkitCompassHeading = 90
        window.dispatchEvent(event)
      })

      // ローパスフィルタの初回値はそのまま入る
      expect(result.current.heading).toBeCloseTo(90, 0)
    })

    it('alpha 付きイベント（Android 形式: deviceorientationabsolute, absolute=true）で heading が更新される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => {
        // alpha=270 → (360 - 270) % 360 = 90 (時計回り変換)
        const event = new Event('deviceorientationabsolute') as Event & { alpha?: number; absolute?: boolean }
        event.alpha = 270
        event.absolute = true
        window.dispatchEvent(event)
      })

      expect(result.current.heading).toBeCloseTo(90, 0)
    })

    it('alpha も webkitCompassHeading も無いイベントでは heading は変わらない', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => {
        const event = new Event('deviceorientation')
        window.dispatchEvent(event)
      })

      expect(result.current.heading).toBeNull()
    })
  })

  // Phase4: iOS 許可フロー
  describe('iOS 許可フロー (DeviceOrientationEvent.requestPermission)', () => {
    type EventCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied' | 'default'> }

    afterEach(() => {
      // 各テスト後に requestPermission をクリーンアップ（次のテストへの汚染防止）
      const ctor = DeviceOrientationEvent as EventCtor
      if ('requestPermission' in ctor) {
        delete ctor.requestPermission
      }
    })

    it('iOS で setEnabled(true) → 許可 granted で enabled=true、リスナー登録される', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const requestPermissionMock = vi.fn().mockResolvedValue('granted')
      ;(DeviceOrientationEvent as EventCtor).requestPermission = requestPermissionMock

      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(true) })

      expect(requestPermissionMock).toHaveBeenCalledTimes(1)
      expect(result.current.enabled).toBe(true)
    })

    it('iOS で setEnabled(true) → 許可 denied で enabled=false、sessionStorage も false', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      const requestPermissionMock = vi.fn().mockResolvedValue('denied')
      ;(DeviceOrientationEvent as EventCtor).requestPermission = requestPermissionMock

      const { result } = renderHook(() => useHeadingIndicator())

      let returnValue: unknown
      await act(async () => { returnValue = await result.current.setEnabled(true) })

      expect(requestPermissionMock).toHaveBeenCalledTimes(1)
      expect(result.current.enabled).toBe(false)
      expect(sessionStorage.setItem).toHaveBeenCalledWith(HEADING_INDICATOR_STORAGE_KEY, 'false')
      // setEnabled は許可拒否時に { granted: false } を返す（呼び出し元がトースト表示等に利用）
      expect(returnValue).toMatchObject({ granted: false })
    })

    it('iOS で setEnabled(true) → 許可 granted で setEnabled は { granted: true } を返す', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      ;(DeviceOrientationEvent as EventCtor).requestPermission = vi.fn().mockResolvedValue('granted')

      const { result } = renderHook(() => useHeadingIndicator())

      let returnValue: unknown
      await act(async () => { returnValue = await result.current.setEnabled(true) })

      expect(returnValue).toMatchObject({ granted: true })
    })

    it('setEnabled(false) では requestPermission を呼ばない', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true')
      const requestPermissionMock = vi.fn().mockResolvedValue('granted')
      ;(DeviceOrientationEvent as EventCtor).requestPermission = requestPermissionMock

      const { result } = renderHook(() => useHeadingIndicator())

      await act(async () => { await result.current.setEnabled(false) })

      expect(requestPermissionMock).not.toHaveBeenCalled()
    })

    it('非iOS（requestPermission 未定義）では setEnabled(true) は { granted: true } を返す', async () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null)
      // requestPermission を定義しない（非iOS パス）
      const { result } = renderHook(() => useHeadingIndicator())

      let returnValue: unknown
      await act(async () => { returnValue = await result.current.setEnabled(true) })

      expect(returnValue).toMatchObject({ granted: true })
      expect(result.current.enabled).toBe(true)
    })
  })
})

// Issue#115 §4: デスクトップ等センサー非対応端末の検出
describe('isHeadingIndicatorAvailable', () => {
  it('matchMedia("(any-pointer: coarse)") が true（タッチ端末）を返す場合、true を返す', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(any-pointer: coarse)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList)

    expect(isHeadingIndicatorAvailable()).toBe(true)
  })

  it('matchMedia("(any-pointer: coarse)") が false（マウス専用デスクトップ）を返す場合、false を返す', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(any-pointer: coarse)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList)

    expect(isHeadingIndicatorAvailable()).toBe(false)
  })
})
