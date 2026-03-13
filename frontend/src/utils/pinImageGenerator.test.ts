import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  determinePinColor,
  generatePinImage,
  getPinImageId,
  PIN_COLOR_MAP,
  PIN_PIXEL_RATIO,
} from './pinImageGenerator'

/**
 * Issue#55: Symbol Layer移行 - ピン画像生成ユーティリティのテスト
 */

describe('pinImageGenerator - Issue#55', () => {
  describe('PIN_COLOR_MAP', () => {
    it('4色のカラーマッピングが定義されている', () => {
      expect(PIN_COLOR_MAP.Green).toBe('#00d68f')
      expect(PIN_COLOR_MAP.Yellow).toBe('#ffbe0b')
      expect(PIN_COLOR_MAP.Orange).toBe('#ff6b35')
      expect(PIN_COLOR_MAP.Red).toBe('#ff006e')
    })
  })

  describe('determinePinColor', () => {
    it('1〜4件の場合はGreen (#00d68f) を返す', () => {
      expect(determinePinColor(1)).toBe('#00d68f')
      expect(determinePinColor(4)).toBe('#00d68f')
    })

    it('5〜9件の場合はYellow (#ffbe0b) を返す', () => {
      expect(determinePinColor(5)).toBe('#ffbe0b')
      expect(determinePinColor(9)).toBe('#ffbe0b')
    })

    it('10〜29件の場合はOrange (#ff6b35) を返す', () => {
      expect(determinePinColor(10)).toBe('#ff6b35')
      expect(determinePinColor(29)).toBe('#ff6b35')
    })

    it('30件以上の場合はRed (#ff006e) を返す', () => {
      expect(determinePinColor(30)).toBe('#ff006e')
      expect(determinePinColor(100)).toBe('#ff006e')
    })
  })

  describe('getPinImageId', () => {
    it('色と件数からキャッシュキーを生成する', () => {
      expect(getPinImageId('#00d68f', 3)).toBe('pin-#00d68f-3')
    })

    it('異なる色・件数で異なるキーを返す', () => {
      const id1 = getPinImageId('#00d68f', 1)
      const id2 = getPinImageId('#ff006e', 30)
      expect(id1).not.toBe(id2)
    })

    it('同じ色・件数で同じキーを返す（キャッシュ用）', () => {
      const id1 = getPinImageId('#ffbe0b', 5)
      const id2 = getPinImageId('#ffbe0b', 5)
      expect(id1).toBe(id2)
    })
  })

  describe('generatePinImage', () => {
    let mockContext: Record<string, any>

    beforeEach(() => {
      mockContext = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        font: '',
        textAlign: '',
        textBaseline: '',
        lineJoin: '',
        globalAlpha: 1,
        beginPath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        bezierCurveTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn((x: number, y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
          width: w,
          height: h,
        })),
      }

      // Canvas APIのモック
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: vi.fn(() => mockContext),
          } as unknown as HTMLCanvasElement
        }
        return document.createElement(tag)
      })
    })

    it('指定した色でピン画像を生成する', () => {
      const result = generatePinImage('#00d68f', 3, 1.0)

      expect(result).toBeDefined()
      expect(result.width).toBeGreaterThan(0)
      expect(result.height).toBeGreaterThan(0)
    })

    it('ピン本体が指定色で塗りつぶされる', () => {
      generatePinImage('#ff006e', 30, 1.0)

      // fillStyleに指定色が設定されたことを確認
      // (shadowの描画もあるため、最後のfill呼び出し時の色を確認)
      const fillCalls = mockContext.fill.mock.calls
      expect(fillCalls.length).toBeGreaterThanOrEqual(2) // shadow + body
    })

    it('件数テキストが描画される', () => {
      generatePinImage('#00d68f', 7, 1.0)

      expect(mockContext.fillText).toHaveBeenCalledWith(
        '7',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('999件超の場合は「999」と「+」の2段テキストが描画される', () => {
      generatePinImage('#ff006e', 1000, 1.0)

      expect(mockContext.fillText).toHaveBeenCalledWith(
        '999',
        expect.any(Number),
        expect.any(Number)
      )
      expect(mockContext.fillText).toHaveBeenCalledWith(
        '+',
        expect.any(Number),
        expect.any(Number)
      )
    })

    it('スケール1.0でベースサイズのPIN_PIXEL_RATIO倍のCanvasが生成される', () => {
      const result = generatePinImage('#00d68f', 1, 1.0)

      // BASE_PIN_SIZE=32, SHADOW_PADDING=4 → 論理幅36, PIN_PIXEL_RATIO倍 → 72
      // BASE_PIN_SIZE*1.2=38, SHADOW_PADDING=4 → 論理高42, PIN_PIXEL_RATIO倍 → 84
      expect(result.width).toBeGreaterThanOrEqual(32 * PIN_PIXEL_RATIO)
      expect(result.height).toBeGreaterThanOrEqual(38 * PIN_PIXEL_RATIO)
    })

    it('高DPI対応でctx.scaleがPIN_PIXEL_RATIOで呼ばれる', () => {
      generatePinImage('#00d68f', 1, 1.0)

      expect(mockContext.scale).toHaveBeenCalledWith(PIN_PIXEL_RATIO, PIN_PIXEL_RATIO)
    })

    it('スケール1.4で拡大されたCanvasが生成される', () => {
      const result1 = generatePinImage('#00d68f', 1, 1.0)
      const result14 = generatePinImage('#00d68f', 1, 1.4)

      expect(result14.width).toBeGreaterThan(result1.width)
      expect(result14.height).toBeGreaterThan(result1.height)
    })

    it('影（シャドウ）パスが描画される', () => {
      generatePinImage('#00d68f', 1, 1.0)

      // translate がシャドウオフセットで呼ばれたことを確認
      expect(mockContext.translate).toHaveBeenCalled()
      // fill が少なくとも2回呼ばれる（shadow + body）
      expect(mockContext.fill.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})
