import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getAuthHeaders } from '../utils/apiClient'
import { API_V1_URL } from '../config/api'
import PhotoDetailDialog from '../components/PhotoDetailDialog'

/** ページ共通のレイアウトクラス */
const PAGE_LAYOUT_CLASS = 'min-h-screen flex items-center justify-center bg-gray-50'

/** カードコンテナの共通クラス */
const CARD_CLASS = 'max-w-md w-full mx-4 bg-white rounded-lg shadow-md p-8'

/**
 * 写真ディープリンクページ
 *
 * Issue#58: /photo-viewer/:photoId でアクセスされたとき、
 * 該当写真をPhotoDetailDialogで単体表示する。
 */
export default function PhotoViewerPage() {
  const { photoId } = useParams<{ photoId: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [photoTitle, setPhotoTitle] = useState('')

  useDocumentTitle(
    photoTitle ? `${photoTitle} - Photlas` : 'Photlas'
  )

  useEffect(() => {
    if (!photoId) {
      setStatus('error')
      setErrorMessage('写真が見つかりません')
      return
    }

    const fetchPhoto = async () => {
      try {
        const response = await fetch(`${API_V1_URL}/photos/${photoId}`, {
          headers: getAuthHeaders(),
        })

        if (response.ok) {
          const data = await response.json()
          setPhotoTitle(data.photo.title || '')
          setStatus('ready')
        } else {
          setStatus('error')
          setErrorMessage('写真が見つかりません')
        }
      } catch {
        setStatus('error')
        setErrorMessage('読み込みに失敗しました')
      }
    }

    fetchPhoto()
  }, [photoId])

  const handleClose = () => {
    navigate('/', { replace: true })
  }

  if (status === 'error') {
    return (
      <div className={PAGE_LAYOUT_CLASS}>
        <div className={`${CARD_CLASS} text-center`}>
          <div className="text-red-500 text-5xl mb-4">&#10007;</div>
          <h2 className="text-xl font-bold mb-2">エラー</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate('/')}
            className="text-primary hover:underline"
          >
            トップページへ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <PhotoDetailDialog
        open={status === 'ready'}
        spotIds={[]}
        singlePhotoId={Number(photoId)}
        onClose={handleClose}
      />
    </div>
  )
}
