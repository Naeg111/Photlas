import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RotateToPortraitOverlay, COMPACT_LANDSCAPE_QUERY } from './RotateToPortraitOverlay'

/**
 * スマートフォン横向き時の案内オーバーレイのテスト。
 *
 * Web ブラウザは端末の向きを固定できないため、
 * 「横向き かつ 画面の高さが小さい（＝スマホ）」ときだけ画面を覆って縦向きを促す。
 * タブレット以上は従来どおり横向きで利用できる。
 */

/** matchMedia を差し替え、change リスナーを後から発火できるようにするヘルパー */
function mockMatchMedia(initialMatches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []

  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: initialMatches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: (e: MediaQueryListEvent) => void) => {
      listeners.push(listener)
    },
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList)

  return {
    /** 端末の向きが変わったことをシミュレートする */
    emitChange: (matches: boolean) => {
      act(() => {
        listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
      })
    },
  }
}

describe('RotateToPortraitOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('スマートフォン横向き（高さが小さい横長画面）のときオーバーレイを表示する', () => {
    mockMatchMedia(true)

    render(<RotateToPortraitOverlay />)

    expect(screen.getByTestId('rotate-to-portrait-overlay')).toBeInTheDocument()
  })

  it('縦向き・タブレット・PC ではオーバーレイを表示しない', () => {
    mockMatchMedia(false)

    render(<RotateToPortraitOverlay />)

    expect(screen.queryByTestId('rotate-to-portrait-overlay')).not.toBeInTheDocument()
  })

  it('利用中に横向きへ回転するとオーバーレイが表示され、縦に戻すと消える', () => {
    const { emitChange } = mockMatchMedia(false)

    render(<RotateToPortraitOverlay />)
    expect(screen.queryByTestId('rotate-to-portrait-overlay')).not.toBeInTheDocument()

    emitChange(true)
    expect(screen.getByTestId('rotate-to-portrait-overlay')).toBeInTheDocument()

    emitChange(false)
    expect(screen.queryByTestId('rotate-to-portrait-overlay')).not.toBeInTheDocument()
  })

  it('判定条件は「横向き」かつ「高さ 600px 以下」である（タブレットを巻き込まない）', () => {
    // iPhone の横向き時の高さは最大 440px 程度、iPad mini は 744px のため 600px で分かれる
    expect(COMPACT_LANDSCAPE_QUERY).toBe('(orientation: landscape) and (max-height: 600px)')
  })
})
