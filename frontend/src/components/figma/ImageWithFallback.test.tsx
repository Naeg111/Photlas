import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ImageWithFallback } from './ImageWithFallback'

// ProtectedImageをモック（ImageWithFallbackの内部依存）
vi.mock('./ProtectedImage', () => ({
  ProtectedImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // onErrorを含む全propsを透過する
    return <img {...props} />
  },
}))

/**
 * ImageWithFallback コンポーネントのテスト
 * 画像読み込みエラー時にフォールバック表示に切り替わることを検証する
 */
describe('ImageWithFallback', () => {
  const defaultProps = {
    src: 'https://example.com/photo.jpg',
    alt: 'テスト画像',
  }

  it('初期状態で画像が表示される', () => {
    render(<ImageWithFallback {...defaultProps} />)

    const img = screen.getByAltText('テスト画像')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('画像エラー時にフォールバック表示に切り替わる', () => {
    const { container } = render(<ImageWithFallback {...defaultProps} />)

    const img = screen.getByAltText('テスト画像')
    fireEvent.error(img)

    // フォールバック画像が表示される
    const fallbackImg = container.querySelector('img[data-original-url]')
    expect(fallbackImg).toBeInTheDocument()
  })

  it('フォールバック表示にグレー背景のプレースホルダーが含まれる', () => {
    const { container } = render(<ImageWithFallback {...defaultProps} />)

    const img = screen.getByAltText('テスト画像')
    fireEvent.error(img)

    const fallbackDiv = container.querySelector('.bg-gray-100')
    expect(fallbackDiv).toBeInTheDocument()
  })

  it('フォールバック表示でもalt属性が保持される（data-original-urlとして）', () => {
    const { container } = render(<ImageWithFallback {...defaultProps} />)

    const img = screen.getByAltText('テスト画像')
    fireEvent.error(img)

    const fallbackImg = container.querySelector('img[data-original-url]')
    expect(fallbackImg).toHaveAttribute('data-original-url', 'https://example.com/photo.jpg')
  })

  it('classNameがコンテナに渡される', () => {
    const { container } = render(
      <ImageWithFallback {...defaultProps} className="w-full h-full" />,
    )

    // エラー前: ProtectedImageにclassNameが渡される
    const img = screen.getByAltText('テスト画像')
    expect(img.className).toContain('w-full h-full')

    // エラー後: フォールバックdivにclassNameが渡される
    fireEvent.error(img)
    const fallbackDiv = container.querySelector('.bg-gray-100')
    expect(fallbackDiv?.className).toContain('w-full h-full')
  })

  it('追加のimg属性がProtectedImageに透過される', () => {
    render(
      <ImageWithFallback
        {...defaultProps}
        data-testid="custom-image"
        loading="lazy"
      />,
    )

    const img = screen.getByAltText('テスト画像')
    expect(img).toHaveAttribute('data-testid', 'custom-image')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  // ============================================================
  // Issue#75: サムネイルフォールバック
  // ============================================================

  it('Issue#75 - サムネイルURL読み込み失敗時にfallbackSrcにフォールバックする', () => {
    render(
      <ImageWithFallback
        src="https://cdn.example.com/thumbnails/uploads/1/test.webp"
        fallbackSrc="https://cdn.example.com/uploads/1/test.jpg"
        alt="テスト画像"
      />,
    )

    const img = screen.getByAltText('テスト画像')
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/thumbnails/uploads/1/test.webp')

    // サムネイル読み込みエラー
    fireEvent.error(img)

    // fallbackSrcに切り替わる（エラープレースホルダーではない）
    const fallbackImg = screen.getByAltText('テスト画像')
    expect(fallbackImg).toHaveAttribute('src', 'https://cdn.example.com/uploads/1/test.jpg')
  })

  it('Issue#75 - fallbackSrcも失敗した場合はエラープレースホルダーが表示される', () => {
    const { container } = render(
      <ImageWithFallback
        src="https://cdn.example.com/thumbnails/uploads/1/test.webp"
        fallbackSrc="https://cdn.example.com/uploads/1/test.jpg"
        alt="テスト画像"
      />,
    )

    // 1回目のエラー: fallbackSrcに切り替わる
    const img = screen.getByAltText('テスト画像')
    fireEvent.error(img)

    // 2回目のエラー: エラープレースホルダーが表示される
    const fallbackImg = screen.getByAltText('テスト画像')
    fireEvent.error(fallbackImg)

    const fallbackDiv = container.querySelector('.bg-gray-100')
    expect(fallbackDiv).toBeInTheDocument()
  })

  it('Issue#75 - fallbackSrcが未指定の場合は従来通りエラープレースホルダーが表示される', () => {
    const { container } = render(
      <ImageWithFallback {...defaultProps} />,
    )

    const img = screen.getByAltText('テスト画像')
    fireEvent.error(img)

    const fallbackDiv = container.querySelector('.bg-gray-100')
    expect(fallbackDiv).toBeInTheDocument()
  })
})
