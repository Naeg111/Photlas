import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Clock, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'

interface UserDetail {
  email: string
  original_username: string
  deleted_at: string
  deletion_hold_until: string | null
  remaining_days: number
  photo_count: number
  violations: Array<{ violation_type: string; action_taken: string; created_at: string }>
  sanctions: Array<{ sanction_type: string; reason: string; created_at: string }>
}

/**
 * Issue#73: 退会済みユーザー詳細ページ
 */
export default function AdminDeletedUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { getAuthToken } = useAuth()
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 即時削除
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // 保持期間延長
  const [isHoldDialogOpen, setIsHoldDialogOpen] = useState(false)
  const [holdUntil, setHoldUntil] = useState('')

  const getAuthHeaders = useCallback(() => ({
    Authorization: `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json',
  }), [getAuthToken])

  const fetchDetail = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      if (response.ok) {
        setDetail(await response.json())
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [userId, getAuthToken])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleImmediateDelete = async () => {
    if (confirmEmail !== detail?.email) {
      toast.error('メールアドレスが一致しません')
      return
    }
    setIsDeleting(true)
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
          body: JSON.stringify({ confirm_email: confirmEmail }),
        }
      )
      if (response.ok) {
        toast.success('ユーザーを削除しました')
        navigate('/manage/deleted-users')
      } else {
        toast.error('削除に失敗しました')
      }
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSetHold = async () => {
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}/hold`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ hold_until: holdUntil + 'T00:00:00' }),
        }
      )
      if (response.ok) {
        toast.success('保持期間を延長しました')
        setIsHoldDialogOpen(false)
        fetchDetail()
      }
    } catch {
      toast.error('保持期間の延長に失敗しました')
    }
  }

  const handleRemoveHold = async () => {
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}/hold`,
        { method: 'DELETE', headers: getAuthHeaders() }
      )
      if (response.ok) {
        toast.success('保持期間延長を解除しました')
        fetchDetail()
      }
    } catch {
      toast.error('解除に失敗しました')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}/export`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      )
      if (response.ok) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deleted-user-${userId}-export.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('エクスポートが完了しました')
      }
    } catch {
      toast.error('エクスポートに失敗しました')
    }
  }

  if (isLoading || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/manage/deleted-users')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">退会済みユーザー詳細</h1>
      </div>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        {/* プロフィール情報 */}
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-gray-800">プロフィール情報</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="text-gray-500">メールアドレス</p>
            <p>{detail.email}</p>
            <p className="text-gray-500">元の表示名</p>
            <p>{detail.original_username}</p>
            <p className="text-gray-500">退会日</p>
            <p>{new Date(detail.deleted_at).toLocaleDateString('ja-JP')}</p>
            <p className="text-gray-500">物理削除まで</p>
            <p>{detail.remaining_days} 日</p>
            {detail.deletion_hold_until && (
              <>
                <p className="text-gray-500">保持延長期限</p>
                <p className="text-yellow-700">{new Date(detail.deletion_hold_until).toLocaleDateString('ja-JP')}</p>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500">写真数: {detail.photo_count} 枚</p>
        </section>

        {/* 違反履歴 */}
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-gray-800">違反・制裁履歴</h2>
          {detail.violations.length === 0 && detail.sanctions.length === 0 ? (
            <p className="text-sm text-gray-500">履歴はありません</p>
          ) : (
            <div className="space-y-2">
              {detail.violations.map((v) => (
                <div key={`v-${v.created_at}`} className="text-sm border-l-2 border-red-300 pl-3">
                  <p className="font-medium">{v.action_taken}</p>
                  <p className="text-gray-500">{v.violation_type} - {new Date(v.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
              ))}
              {detail.sanctions.map((s) => (
                <div key={`s-${s.created_at}`} className="text-sm border-l-2 border-orange-300 pl-3">
                  <p className="font-medium">{s.sanction_type}</p>
                  <p className="text-gray-500">{s.reason} - {new Date(s.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* アクションボタン */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">操作</h2>
          <div className="flex flex-wrap gap-2">
            {detail.deletion_hold_until ? (
              <Button variant="outline" onClick={handleRemoveHold}>
                <Clock className="w-4 h-4 mr-2" />
                保持延長を解除
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setIsHoldDialogOpen(true)}>
                <Clock className="w-4 h-4 mr-2" />
                保持期間延長
              </Button>
            )}
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              データエクスポート
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              即時削除
            </Button>
          </div>
        </section>

        {/* 即時削除ダイアログ */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
              <h3 className="font-semibold text-red-600">即時削除の確認</h3>
              <p className="text-sm text-gray-600">
                この操作は取り消せません。確認のため、対象ユーザーのメールアドレスを入力して確認してください。
              </p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">{detail.email}</p>
              <Input
                placeholder="メールアドレスを入力して確認"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setConfirmEmail('') }}>
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleImmediateDelete}
                  disabled={isDeleting || confirmEmail !== detail.email}
                >
                  {isDeleting ? '削除中...' : '完全に削除する'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 保持期間延長ダイアログ */}
        {isHoldDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
              <h3 className="font-semibold">保持期間延長</h3>
              <p className="text-sm text-gray-600">延長期限日を指定してください。</p>
              <Input
                type="date"
                value={holdUntil}
                onChange={(e) => setHoldUntil(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSetHold} disabled={!holdUntil}>
                  延長する
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
