/**
 * 認証コンテキスト
 * Issue#5: ログイン・ログアウト機能
 * Issue#36: ユーザー情報更新機能追加
 */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface User {
  username: string
  email: string
  role: string
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
        const parsedUser = JSON.parse(savedUser)
        setUser(parsedUser)
        setIsAuthenticated(true)
      } catch {
        logout()
      }
    }
  }, [])

  const login = (userData: User, token: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage

    storage.setItem('auth_token', token)
    storage.setItem('auth_user', JSON.stringify(userData))

    setUser(userData)
    setIsAuthenticated(true)
  }

  const logout = () => {
    // 両方のストレージから削除
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')

    setUser(null)
    setIsAuthenticated(false)
  }

  const getAuthToken = (): string | null => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  }

  /**
   * Issue#36: ユーザー情報を部分更新
   * ログイン中のユーザー情報を更新し、ストレージにも保存する
   */
  const updateUser = (updatedUser: Partial<User>) => {
    if (!user) return

    const newUser = { ...user, ...updatedUser }
    setUser(newUser)

    // ストレージも更新（localStorageかsessionStorageのどちらを使っているか確認）
    const storage = localStorage.getItem('auth_token') ? localStorage : sessionStorage
    storage.setItem('auth_user', JSON.stringify(newUser))
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    login,
    logout,
    getAuthToken,
    updateUser
  }

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