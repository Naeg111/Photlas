import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { API_V1_URL } from '../config/api'

/**
 * Issue#15: 写真フルサイズ表示 (UI / 専用ビューアー)
 *
 * 【目的】
 * - 写真を高解像度で大きく表示する専用ビューアー
 * - 細部まで確認でき、撮影場所の魅力を深く理解できる
 *
 * 【機能】
 * - 背景色白、画像のみ表示（ヘッダー/フッター/ボタンなし）
 * - 画像を画面中央に配置
 * - object-fit: contain で全体表示
 * - 右クリック、ドラッグ&ドロップ制限
 * - モバイル長押し保存メニュー抑制
 */

interface PhotoData {
  photo: {
    photo_id: number
    title: string
    image_url: string
    shot_at: string
    weather: string
  }
  spot: {
    spot_id: number
  }
  user: {
    user_id: number
    username: string
  }
}

function PhotoViewerPage() {
  const { photoId } = useParams<{ photoId: string }>()
  const [photoData, setPhotoData] = useState<PhotoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPhoto = async () => {
      if (!photoId) {
        setError('写真IDが指定されていません')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`${API_V1_URL}/photos/${photoId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('写真が見つかりません')
          } else {
            setError('画像の読み込みに失敗しました')
          }
          setLoading(false)
          return
        }

        const data: PhotoData = await response.json()
        setPhotoData(data)
        setError(null)
      } catch (err) {
        setError('画像の読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchPhoto()
  }, [photoId])

  // ローディング中の表示
  if (loading) {
    return (
      <div
        data-testid="photo-viewer-container"
        className="w-full h-screen bg-white flex items-center justify-center"
      >
        <div className="text-gray-600 text-lg">読み込み中...</div>
      </div>
    )
  }

  // エラー時の表示
  if (error) {
    return (
      <div
        data-testid="photo-viewer-container"
        className="w-full h-screen bg-white flex items-center justify-center"
      >
        <div className="text-red-600 text-lg">{error}</div>
      </div>
    )
  }

  // 画像データがない場合
  if (!photoData) {
    return (
      <div
        data-testid="photo-viewer-container"
        className="w-full h-screen bg-white flex items-center justify-center"
      >
        <div className="text-gray-600 text-lg">画像データがありません</div>
      </div>
    )
  }

  return (
    <div
      data-testid="photo-viewer-container"
      className="w-full h-screen bg-white flex items-center justify-center"
    >
      <img
        src={photoData.photo.image_url}
        alt={photoData.photo.title || '写真'}
        className="object-contain max-w-full max-h-full select-none"
        style={{
          WebkitTouchCallout: 'none',
          userSelect: 'none',
          WebkitUserDrag: 'none',
        } as React.CSSProperties}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  )
}

export default PhotoViewerPage
