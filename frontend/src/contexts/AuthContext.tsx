/**
 * 認証コンテキスト
 * Issue#5: ログイン・ログアウト機能
 * Issue#36: ユーザー情報更新機能追加
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'

interface User {
  userId: number
  username: string
  email: string
  role: number
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (user: User, token: string, remember: boolean) => void
  logout: () => void
  getAuthToken: () => string | null
  updateUser: (updatedUser: Partial<User>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  useEffect(() => {
    // ページ読み込み時に保存されたトークンを確認
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
    const savedUser = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user')

    if (token && savedUser) {
      try {
        // JWTトークンの有効期限チェック
        const payloadBase64 = token.split('.')[1]
        if (payloadBase64) {
          const payload = JSON.parse(atob(payloadBase64))
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            logout()
            return
          }
        }

        const parsedUser = JSON.parse(savedUser)
        if (!parsedUser.userId) {
          // userIdがない古いデータの場合は再ログインを要求
          logout()
          return
        }
        setUser(parsedUser)
        setIsAuthenticated(true)
      } catch {
        logout()
      }
    }
  }, [])

  const login = useCallback((userData: User, token: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage

    storage.setItem('auth_token', token)
    storage.setItem('auth_user', JSON.stringify(userData))

    setUser(userData)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    // 両方のストレージから削除
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')

    setUser(null)
    setIsAuthenticated(false)
  }, [])

  const getAuthToken = useCallback((): string | null => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  }, [])

  /**
   * Issue#36: ユーザー情報を部分更新
   * ログイン中のユーザー情報を更新し、ストレージにも保存する
   */
  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev
      const newUser = { ...prev, ...updatedUser }
      const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage
      storage.setItem('auth_user', JSON.stringify(newUser))
      return newUser
    })
  }, [])

  const value = useMemo<AuthContextType>(() => ({
    user,
    isAuthenticated,
    login,
    logout,
    getAuthToken,
    updateUser
  }), [user, isAuthenticated, login, logout, getAuthToken, updateUser])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}