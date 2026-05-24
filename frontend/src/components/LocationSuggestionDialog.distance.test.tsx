import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationSuggestionDialog } from './LocationSuggestionDialog'

/**
 * Issue#146: 撮影場所指摘の距離バリデーション
 *
 * - 下限: 元の撮影場所から 30m 未満は「近すぎ」エラー（全写真共通）
 * - 上限: GPS 写真（locationFromExif=true）は 1km 超で「離れすぎ」エラー
 * - GPS なし写真は上限なし（下限 30m のみ）
 */

// 元の撮影場所（赤マーカー＝写真の現在位置）
const CURRENT_LAT = 35.658581
const CURRENT_LNG = 139.745433
// 緯度 1 度あたりのメートル数（6371000 * PI / 180）
const METERS_PER_DEGREE = (6371000 * Math.PI) / 180
const latOffset = (meters: number) => CURRENT_LAT + meters / METERS_PER_DEGREE

// 各シナリオの指摘地点（経度は同じ、緯度のみずらす）
const NEAR = { lat: latOffset(10), lng: CURRENT_LNG } // 約10m（30m未満）
const VALID = { lat: latOffset(100), lng: CURRENT_LNG } // 約100m（30m〜1km）
const FAR = { lat: latOffset(1500), lng: CURRENT_LNG } // 約1500m（1km超）

// InlineMapPicker のモック（指定距離のピン移動をボタンで再現）
vi.mock('./InlineMapPicker', () => ({
  InlineMapPicker: ({ onPositionChange }: {
    onPositionChange?: (pos: { lat: number; lng: number }) => void
  }) => (
    <div data-testid="inline-map-picker">
      <button onClick={() => onPositionChange?.(NEAR)}>move-near</button>
      <button onClick={() => onPositionChange?.(VALID)}>move-valid</button>
      <button onClick={() => onPositionChange?.(FAR)}>move-far</button>
    </div>
  ),
}))

vi.mock('@mapbox/search-js-core', () => ({
  SearchBoxCore: vi.fn(),
  SessionToken: vi.fn(),
}))

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  photoId: 1,
  currentLatitude: CURRENT_LAT,
  currentLongitude: CURRENT_LNG,
}

const submitButton = () => screen.getByRole('button', { name: '送信' })

describe('LocationSuggestionDialog 距離バリデーション (Issue#146)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('30m 未満の指摘は「近すぎ」エラーが表示され送信ボタンが非活性', () => {
    render(<LocationSuggestionDialog {...baseProps} locationFromExif={false} />)
    fireEvent.click(screen.getByText('move-near'))

    expect(screen.getByText(/近すぎ/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('GPS写真は 1km 超の指摘で「離れすぎ」エラーが表示され送信ボタンが非活性', () => {
    render(<LocationSuggestionDialog {...baseProps} locationFromExif={true} />)
    fireEvent.click(screen.getByText('move-far'))

    expect(screen.getByText(/離れすぎ/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('GPS写真でも 30m〜1km の指摘は送信ボタンが活性', () => {
    render(<LocationSuggestionDialog {...baseProps} locationFromExif={true} />)
    fireEvent.click(screen.getByText('move-valid'))

    expect(screen.queryByText(/近すぎ/)).not.toBeInTheDocument()
    expect(screen.queryByText(/離れすぎ/)).not.toBeInTheDocument()
    expect(submitButton()).not.toBeDisabled()
  })

  it('GPSなし写真は 1km 超でも「離れすぎ」エラーが出ず送信できる（上限なし）', () => {
    render(<LocationSuggestionDialog {...baseProps} locationFromExif={false} />)
    fireEvent.click(screen.getByText('move-far'))

    expect(screen.queryByText(/離れすぎ/)).not.toBeInTheDocument()
    expect(submitButton()).not.toBeDisabled()
  })

  it('GPSなし写真でも 30m 未満は「近すぎ」エラーで送信不可（下限は全写真共通）', () => {
    render(<LocationSuggestionDialog {...baseProps} locationFromExif={false} />)
    fireEvent.click(screen.getByText('move-near'))

    expect(screen.getByText(/近すぎ/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })
})
