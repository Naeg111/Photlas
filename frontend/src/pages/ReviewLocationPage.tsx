import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Map, { Marker } from 'react-map-gl'
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLE } from '../config/mapbox'
import { PinSvg } from '../components/PinSvg'
import { Button } from '../components/ui/button'
import { LoginDialog } from '../components/LoginDialog'
import { useAuth } from '../contexts/AuthContext'
import { getAuthHeaders } from '../utils/apiClient'
import { API_V1_URL } from '../config/api'

/**
 * Issue#65: 位置情報修正のレビューページ
 */

const MSG_FETCH_ERROR = 'レビュー情報の取得に失敗しました'
const MSG_ACTION_ERROR = '処理に失敗しました'

interface ReviewData {
  suggestionId: number
  currentLatitude: number
  currentLongitude: number
  suggestedLatitude: number
  suggestedLongitude: number
  photoTitle: string
}

export default function ReviewLocationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { user } = useAuth()

  const [reviewData, setReviewData] = useState<ReviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isResolved, setIsResolved] = useState(false)
  const [resolvedMessage, setResolvedMessage] = useState('')
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false)

  useEffect(() => {
    if (!token || !user) return

    const fetchReviewData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `${API_V1_URL}/location-suggestions/review?token=${token}`,
          {
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json',
            },
          }
        )
        if (!response.ok) {
          throw new Error(MSG_FETCH_ERROR)
        }
        const data = await response.json()
        setReviewData(data)
      } catch {
        setError(MSG_FETCH_ERROR)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviewData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user])

  const handleAction = async (action: 'accept' | 'reject') => {
    if (!token) return
    setIsLoading(true)
    try {
      const response = await fetch(
        `${API_V1_URL}/location-suggestions/review/${action}?token=${token}`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }
      )
      if (!response.ok) {
        throw new Error(MSG_ACTION_ERROR)
      }
      setIsResolved(true)
      setResolvedMessage(
        action === 'accept'
          ? '撮影場所の指摘を受け入れました。'
          : '撮影場所の指摘を拒否しました。'
      )
    } catch {
      setError(MSG_ACTION_ERROR)
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">無効なリンクです</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg">ログインが必要です</p>
        <p className="text-sm text-gray-600">レビューを行うにはログインしてください。</p>
        <Button onClick={() => setIsLoginDialogOpen(true)}>
          ログイン
        </Button>
        <LoginDialog
          open={isLoginDialogOpen}
          onOpenChange={setIsLoginDialogOpen}
          onShowSignUp={() => setIsLoginDialogOpen(false)}
          onShowPasswordReset={() => setIsLoginDialogOpen(false)}
        />
      </div>
    )
  }

  if (isResolved) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">{resolvedMessage}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">{error}</p>
      </div>
    )
  }

  if (isLoading || !reviewData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">読み込み中...</p>
      </div>
    )
  }

  const centerLat = (reviewData.currentLatitude + reviewData.suggestedLatitude) / 2
  const centerLng = (reviewData.currentLongitude + reviewData.suggestedLongitude) / 2

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-xl font-bold mb-4">撮影場所の指摘レビュー</h1>

      <div className="w-full max-w-lg h-80 rounded-lg overflow-hidden mb-4">
        <Map
          mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
          initialViewState={{
            latitude: centerLat,
            longitude: centerLng,
            zoom: 13,
          }}
          mapStyle={MAPBOX_STYLE}
        >
          {/* 現在の撮影地点（赤） */}
          <Marker latitude={reviewData.currentLatitude} longitude={reviewData.currentLongitude}>
            <div style={{ width: 32, height: 38 }}><PinSvg fill="#EF4444" stroke="#B91C1C" /></div>
          </Marker>

          {/* 指摘された地点（青） */}
          <Marker latitude={reviewData.suggestedLatitude} longitude={reviewData.suggestedLongitude}>
            <div style={{ width: 32, height: 38 }}><PinSvg fill="#3B82F6" stroke="#1D4ED8" /></div>
          </Marker>
        </Map>
      </div>

      <div className="flex gap-4">
        <Button onClick={() => handleAction('accept')} disabled={isLoading}>
          受け入れる
        </Button>
        <Button variant="outline" onClick={() => handleAction('reject')} disabled={isLoading}>
          拒否する
        </Button>
      </div>
    </div>
  )
}
