import { describe, it, expect } from 'vitest'
import { clampLightboxPan } from './lightboxPan'

/**
 * ライトボックスのパン量クランプのテスト。
 *
 * 本番で「拡大縮小を繰り返すと画像が画面の端に移動してしまう」不具合の修正。
 * 拡大率が下がったら、はみ出せる量も縮み、最終的に画面中央へ戻ることを保証する。
 */

// 画面 1000 x 800、画像は等倍で 900 x 600 とする
const VIEWPORT = { width: 1000, height: 800 }
const CONTENT = { width: 900, height: 600 }

describe('clampLightboxPan', () => {
  it('等倍では画像が画面に収まるため、ドラッグしても必ず中央（0, 0）に戻る', () => {
    const result = clampLightboxPan({ x: 400, y: -300 }, 1, CONTENT, VIEWPORT)

    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('画面より小さく縮小した場合も中央（0, 0）に戻る', () => {
    const result = clampLightboxPan({ x: 250, y: 250 }, 0.5, CONTENT, VIEWPORT)

    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('拡大時ははみ出した分だけドラッグできる（上限 = (拡大後サイズ - 画面サイズ) / 2）', () => {
    // 2倍: 画像 1800 x 1200、画面 1000 x 800 → 上限 x=400, y=200
    const result = clampLightboxPan({ x: 300, y: 100 }, 2, CONTENT, VIEWPORT)

    expect(result).toEqual({ x: 300, y: 100 })
  })

  it('拡大時に上限を超えるドラッグ量は上限で頭打ちになる', () => {
    const result = clampLightboxPan({ x: 9999, y: 9999 }, 2, CONTENT, VIEWPORT)

    expect(result).toEqual({ x: 400, y: 200 })
  })

  it('マイナス方向のドラッグ量も上限で頭打ちになる', () => {
    const result = clampLightboxPan({ x: -9999, y: -9999 }, 2, CONTENT, VIEWPORT)

    expect(result).toEqual({ x: -400, y: -200 })
  })

  it('拡大して端までドラッグした後に等倍へ戻すと、中央（0, 0）に復帰する（本番で発生した不具合）', () => {
    const panned = clampLightboxPan({ x: 9999, y: 9999 }, 3, CONTENT, VIEWPORT)
    expect(panned).not.toEqual({ x: 0, y: 0 })

    // 拡大率だけ 1 に戻したときに、残っていた移動量が中央へ丸められる
    const zoomedBack = clampLightboxPan(panned, 1, CONTENT, VIEWPORT)

    expect(zoomedBack).toEqual({ x: 0, y: 0 })
  })

  it('画像サイズが未測定（0）でも例外にならず中央を返す', () => {
    const result = clampLightboxPan({ x: 100, y: 100 }, 2, { width: 0, height: 0 }, VIEWPORT)

    expect(result).toEqual({ x: 0, y: 0 })
  })
})
