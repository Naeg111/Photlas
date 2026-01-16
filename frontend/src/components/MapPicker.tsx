import { useState, useEffect } from 'react'

/**
 * Issue#8: 位置設定用地図ピッカー (UI)
 * TDD Green段階: テストをパスする最小限の実装
 *
 * Props:
 * - open: ピッカーの表示/非表示
 * - initialCenter: 初期座標（オプション、デフォルトは日本全体）
 * - onConfirm: 座標確定時のコールバック
 * - onCancel: キャンセル時のコールバック
 */

interface MapPickerProps {
  open: boolean
  initialCenter?: { lat: number; lng: number }
  onConfirm: (coords: { lat: number; lng: number }) => void
  onCancel: () => void
}

const DEFAULT_CENTER = { lat: 36.5, lng: 138.0 } // 日本全体のデフォルト座標

export default function MapPicker({
  open,
  initialCenter,
  onConfirm,
  onCancel
}: MapPickerProps) {
  // 現在の地図の中心座標を管理
  const [center, setCenter] = useState(initialCenter || DEFAULT_CENTER)
  // 検索バーの入力値を管理
  const [searchQuery, setSearchQuery] = useState('')
  // エラーメッセージを管理
  const [errorMessage, setErrorMessage] = useState('')

  // モーダルが閉じられたときに状態をリセット
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setErrorMessage('')
      setCenter(initialCenter || DEFAULT_CENTER)
    } else {
      setCenter(initialCenter || DEFAULT_CENTER)
    }
  }, [open, initialCenter])

  // 現在地を取得する関数
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage('位置情報の取得に失敗しました')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setCenter(newCenter)
        setErrorMessage('')
      },
      () => {
        setErrorMessage('位置情報の取得に失敗しました')
      }
    )
  }

  // 決定ボタンのハンドラー
  const handleConfirm = () => {
    onConfirm(center)
  }

  // キャンセルボタンのハンドラー
  const handleCancel = () => {
    onCancel()
  }

  // openがfalseの場合は何も表示しない
  if (!open) {
    return null
  }

  return (
    <div
      data-testid="map-picker"
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      {/* ヘッダー部分: 検索バーとキャンセルボタン */}
      <div className="relative z-10 flex items-center gap-4 bg-white p-4 shadow-md">
        <input
          type="text"
          placeholder="場所を検索"
          aria-label="場所を検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCancel}
          aria-label="キャンセル"
          className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
        >
          キャンセル
        </button>
      </div>

      {/* エラーメッセージ表示 */}
      {errorMessage && (
        <div className="bg-red-100 px-4 py-2 text-red-700">
          {errorMessage}
        </div>
      )}

      {/* 地図コンテナ */}
      <div className="relative flex-1">
        <div
          data-testid="map-container"
          className="h-full w-full bg-gray-100"
        >
          {/* 実際の地図は後で実装 */}
          <div className="flex h-full items-center justify-center text-gray-500">
            Map will be displayed here
          </div>
        </div>

        {/* 固定ピン（画面中央） */}
        <div
          data-testid="center-pin"
          className="pointer-events-none fixed absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-full"
        >
          {/* ピンのアイコン */}
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="#EA4335"
            />
            <circle cx="12" cy="9" r="2.5" fill="white" />
          </svg>
        </div>

        {/* 現在地ボタン */}
        <button
          onClick={handleCurrentLocation}
          aria-label="現在地へ移動"
          className="absolute bottom-24 right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-50"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"
              fill="#666"
            />
          </svg>
        </button>
      </div>

      {/* 決定ボタン（画面下部） */}
      <div className="relative z-10 bg-white p-4 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <button
          onClick={handleConfirm}
          aria-label="この位置に決定"
          className="w-full rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          この位置に決定
        </button>
      </div>
    </div>
  )
}
