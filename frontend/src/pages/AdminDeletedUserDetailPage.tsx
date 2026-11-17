import { useState, useEffect, useCallback } from 'react'
import { useRobotsNoindex } from '../hooks/useRobotsNoindex'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Clock, Download } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'
import { useLatest } from '../hooks/useLatest'
import {
  ACTION_TAKEN_I18N_KEYS,
  REPORT_REASON_I18N_KEYS,
  SANCTION_TYPE_I18N_KEYS,
} from '../utils/codeConstants'

interface UserDetail {
  email: string
  original_username: string
  deleted_at: string
  deletion_hold_until: string | null
  remaining_days: number
  photo_count: number
  violations: Array<{ violation_type: number; action_taken: number; created_at: string }>
  sanctions: Array<{ sanction_type: number; reason: string; created_at: string }>
}

/**
 * Issue#73: 退会済みユーザー詳細ページ
 */
export default function AdminDeletedUserDetailPage() {
  useRobotsNoindex()
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { getAuthToken } = useAuth()
  const { t, i18n } = useTranslation()
  // fetchDetail を t に依存させず、言語の切り替えで再取得しないよう、ref 経由で今の言語の t を使う。
  // ref を使うのは useEffect の依存に入る fetchDetail だけ。ほかのハンドラーは依存に入らないので t のままでよい。
  const tRef = useLatest(t)

  /** Spec#93 追加対応: 数値コードを表示言語の名前にする（未知のコードは数値のまま出す） */
  const codeLabel = (keys: Record<number, string>, code: number) =>
    keys[code] ? t(keys[code]) : String(code)
  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language)
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
      toast.error(tRef.current('admin.deletedUser.fetchFailed'))
    } finally {
      setIsLoading(false)
    }
  }, [userId, getAuthToken])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const handleImmediateDelete = async () => {
    if (confirmEmail !== detail?.email) {
      toast.error(t('admin.deletedUser.emailMismatch'))
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
        toast.success(t('admin.deletedUser.deleteSuccess'))
        navigate('/manage/deleted-users')
      } else {
        toast.error(t('admin.deletedUser.deleteFailed'))
      }
    } catch {
      toast.error(t('admin.deletedUser.deleteFailed'))
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
        toast.success(t('admin.deletedUser.holdSuccess'))
        setIsHoldDialogOpen(false)
        fetchDetail()
      }
    } catch {
      toast.error(t('admin.deletedUser.holdFailed'))
    }
  }

  const handleRemoveHold = async () => {
    try {
      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users/${userId}/hold`,
        { method: 'DELETE', headers: getAuthHeaders() }
      )
      if (response.ok) {
        toast.success(t('admin.deletedUser.removeHoldSuccess'))
        fetchDetail()
      }
    } catch {
      toast.error(t('admin.deletedUser.removeHoldFailed'))
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
        toast.success(t('admin.deletedUser.exportSuccess'))
      }
    } catch {
      toast.error(t('admin.deletedUser.exportFailed'))
    }
  }

  if (isLoading || !detail) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
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
        <h1 className="text-lg font-semibold">{t('admin.deletedUser.title')}</h1>
      </div>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        {/* プロフィール情報 */}
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-gray-800">{t('admin.deletedUser.profileSection')}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="text-gray-500">{t('admin.deletedUser.email')}</p>
            <p>{detail.email}</p>
            <p className="text-gray-500">{t('admin.deletedUser.originalUsername')}</p>
            <p>{detail.original_username}</p>
            <p className="text-gray-500">{t('admin.deletedUser.deletedAt')}</p>
            <p>{formatDate(detail.deleted_at)}</p>
            <p className="text-gray-500">{t('admin.deletedUser.untilPhysicalDeletion')}</p>
            <p>{t('admin.deletedUser.days', { days: detail.remaining_days })}</p>
            {detail.deletion_hold_until && (
              <>
                <p className="text-gray-500">{t('admin.deletedUser.holdUntil')}</p>
                <p className="text-yellow-700">{formatDate(detail.deletion_hold_until)}</p>
              </>
            )}
          </div>
          <p className="text-sm text-gray-500">{t('admin.deletedUser.photoCount', { total: detail.photo_count })}</p>
        </section>

        {/* 違反履歴 */}
        <section className="bg-white border rounded-lg p-4 space-y-2">
          <h2 className="font-semibold text-gray-800">{t('admin.deletedUser.historySection')}</h2>
          {detail.violations.length === 0 && detail.sanctions.length === 0 ? (
            <p className="text-sm text-gray-500">{t('admin.deletedUser.noHistory')}</p>
          ) : (
            <div className="space-y-2">
              {detail.violations.map((v) => (
                <div key={`v-${v.created_at}`} className="text-sm border-l-2 border-red-300 pl-3">
                  <p className="font-medium">{codeLabel(ACTION_TAKEN_I18N_KEYS, v.action_taken)}</p>
                  <p className="text-gray-500">{codeLabel(REPORT_REASON_I18N_KEYS, v.violation_type)} - {formatDate(v.created_at)}</p>
                </div>
              ))}
              {detail.sanctions.map((s) => (
                <div key={`s-${s.created_at}`} className="text-sm border-l-2 border-orange-300 pl-3">
                  <p className="font-medium">{codeLabel(SANCTION_TYPE_I18N_KEYS, s.sanction_type)}</p>
                  <p className="text-gray-500">{s.reason} - {formatDate(s.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* アクションボタン */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold text-gray-800">{t('admin.deletedUser.actionsSection')}</h2>
          <div className="flex flex-wrap gap-2">
            {detail.deletion_hold_until ? (
              <Button variant="outline" onClick={handleRemoveHold}>
                <Clock className="w-4 h-4 mr-2" />
                {t('admin.deletedUser.removeHold')}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setIsHoldDialogOpen(true)}>
                <Clock className="w-4 h-4 mr-2" />
                {t('admin.deletedUser.extendHold')}
              </Button>
            )}
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              {t('admin.deletedUser.export')}
            </Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t('admin.deletedUser.immediateDelete')}
            </Button>
          </div>
        </section>

        {/* 即時削除ダイアログ */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
              <h3 className="font-semibold text-red-600">{t('admin.deletedUser.deleteConfirmTitle')}</h3>
              <p className="text-sm text-gray-600">
                {t('admin.deletedUser.deleteConfirmDescription')}
              </p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded">{detail.email}</p>
              <Input
                placeholder={t('admin.deletedUser.emailConfirmPlaceholder')}
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setConfirmEmail('') }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleImmediateDelete}
                  disabled={isDeleting || confirmEmail !== detail.email}
                >
                  {isDeleting ? t('admin.deletedUser.deleting') : t('admin.deletedUser.deletePermanently')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 保持期間延長ダイアログ */}
        {isHoldDialogOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
              <h3 className="font-semibold">{t('admin.deletedUser.extendHold')}</h3>
              <p className="text-sm text-gray-600">{t('admin.deletedUser.holdDialogDescription')}</p>
              <Input
                type="date"
                value={holdUntil}
                onChange={(e) => setHoldUntil(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsHoldDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSetHold} disabled={!holdUntil}>
                  {t('admin.deletedUser.extend')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
