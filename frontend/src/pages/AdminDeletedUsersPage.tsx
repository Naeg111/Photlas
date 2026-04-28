import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, UserX } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useAuth } from '../contexts/AuthContext'
import { API_V1_URL } from '../config/api'

interface DeletedUser {
  user_id: number
  email: string
  original_username: string
  deleted_at: string
  remaining_days: number
  hold_active: boolean
}

/**
 * Issue#73: 退会済みユーザー管理ページ
 */
export default function AdminDeletedUsersPage() {
  const navigate = useNavigate()
  const { getAuthToken } = useAuth()
  const [users, setUsers] = useState<DeletedUser[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const fetchUsers = useCallback(async (searchQuery?: string) => {
    setIsLoading(true)
    try {
      const token = getAuthToken()
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)

      const response = await fetch(
        `${API_V1_URL}/admin/deleted-users?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (response.ok) {
        const data = await response.json()
        setUsers(data.content || [])
      }
    } catch {
      // エラー時は空リスト
    } finally {
      setIsLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = () => {
    fetchUsers(search)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">退会済みユーザー管理</h1>
      </div>

      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="メールアドレスまたは表示名で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} variant="outline">
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {isLoading && (
          <div className="text-center py-8 text-gray-500">読み込み中...</div>
        )}
        {!isLoading && users.length === 0 && (
          <div className="text-center py-8 text-gray-500">退会済みユーザーはいません</div>
        )}
        {!isLoading && users.length > 0 && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="bg-white border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") navigate(`/manage/deleted-users/${user.user_id}`) }} onClick={() => navigate(`/manage/deleted-users/${user.user_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserX className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{user.email}</p>
                      <p className="text-sm text-gray-500">{user.original_username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">残り {user.remaining_days} 日</p>
                    {user.hold_active && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                        保持延長中
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
