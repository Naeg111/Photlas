import { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useLoadScript } from '@react-google-maps/api'
import { MapPin, LocateFixed, Search } from 'lucide-react'
import { Button } from './ui/button'

/**
 * InlineMapPicker コンポーネント
 * Issue#9: 写真投稿時の位置選択用インライン地図ピッカー
 *
 * 地図をドラッグして中央のピンで位置を選択する
 * 検索候補はAutocompleteServiceで取得し、コンポーネント内に描画する
 * （Radix UIモーダルの pointer-events:none 制約を回避するため）
 */

interface InlineMapPickerProps {
  position: { lat: number; lng: number } | null
  onPositionChange: (position: { lat: number; lng: number }) => void
}

// 地図の初期設定
const DEFAULT_CENTER = { lat: 35.6762, lng: 139.6503 } // 新宿
const DEFAULT_ZOOM = 15

// Google Maps APIキー
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

// Places ライブラリ（useLoadScriptのlibrariesは定数参照が必要）
const LIBRARIES: ('places')[] = ['places']

const mapContainerStyle = {
  width: '100%',
  height: '100%',
}

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
}

export function InlineMapPicker({ position, onPositionChange }: InlineMapPickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  // 検索関連のstate
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })

  // AutocompleteService と Geocoder を初期化
  useEffect(() => {
    if (!isLoaded) return
    autocompleteServiceRef.current = new google.maps.places.AutocompleteService()
    geocoderRef.current = new google.maps.Geocoder()
  }, [isLoaded])

  // 検索入力ハンドラー（デバウンス付き）
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!value.trim() || !autocompleteServiceRef.current) {
      setPredictions([])
      setIsDropdownOpen(false)
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        { input: value, componentRestrictions: { country: 'jp' } },
        (results) => {
          setPredictions(results || [])
          setIsDropdownOpen((results?.length ?? 0) > 0)
        }
      )
    }, 300)
  }, [])

  // 候補選択ハンドラー
  const handleSelectPrediction = useCallback((prediction: google.maps.places.AutocompletePrediction) => {
    if (!geocoderRef.current) return

    geocoderRef.current.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const lat = results[0].geometry.location.lat()
        const lng = results[0].geometry.location.lng()
        mapRef.current?.panTo({ lat, lng })
        onPositionChangeRef.current({ lat, lng })
      }
    })

    setSearchQuery(prediction.structured_formatting.main_text)
    setPredictions([])
    setIsDropdownOpen(false)
  }, [])

  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    mapRef.current = mapInstance

    // 地図のドラッグ終了時に中心座標を取得
    mapInstance.addListener('idle', () => {
      const center = mapInstance.getCenter()
      if (center) {
        onPositionChangeRef.current({
          lat: center.lat(),
          lng: center.lng(),
        })
      }
    })
  }, [])

  const handleCurrentLocation = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCenter = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        mapRef.current?.panTo(newCenter)
        onPositionChangeRef.current(newCenter)
      },
      (error) => {
        console.error('位置情報の取得に失敗しました:', error)
      },
      { enableHighAccuracy: true }
    )
  }, [])

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClick = () => setIsDropdownOpen(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [isDropdownOpen])

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
        地図の読み込みに失敗しました
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
        地図を読み込み中...
      </div>
    )
  }

  const center = position || DEFAULT_CENTER

  return (
    <div className="relative h-full">
      {/* 地図レイヤー */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={DEFAULT_ZOOM}
        options={mapOptions}
        onLoad={handleLoad}
      />

      {/* オーバーレイレイヤー（地図の上に配置） */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
        {/* 検索バー + 候補リスト */}
        <div className="absolute top-2 left-2 right-2 pointer-events-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="場所を検索"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {/* 検索候補ドロップダウン */}
            {isDropdownOpen && predictions.length > 0 && (
              <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {predictions.map((prediction) => (
                  <li
                    key={prediction.place_id}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 border-b border-gray-50 last:border-b-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectPrediction(prediction)}
                  >
                    <div className="font-medium">{prediction.structured_formatting.main_text}</div>
                    <div className="text-xs text-gray-500">{prediction.structured_formatting.secondary_text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 中央固定ピン */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
          <MapPin className="w-10 h-10 text-red-500 drop-shadow-lg" />
        </div>

        {/* 現在地ボタン */}
        <div className="absolute bottom-2 right-2 pointer-events-auto">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="bg-white shadow-lg"
            onClick={handleCurrentLocation}
            aria-label="現在地へ移動"
          >
            <LocateFixed className="w-5 h-5" />
          </Button>
        </div>

        {/* 座標表示 */}
        {position && (
          <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-xs shadow">
            緯度: {position.lat.toFixed(4)}, 経度: {position.lng.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  )
}
