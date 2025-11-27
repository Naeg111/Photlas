import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const LogoutButton: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) {
    return null
  }

  const handleLogout = () => {
    try {
      logout()
      navigate('/')
    } catch (error) {
      console.error('Logout error:', error)
      // エラーが発生してもナビゲーションは実行
      navigate('/')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogout()
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      onKeyDown={handleKeyDown}
      className="logout-button inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
    >
      ログアウト
    </button>
  )
}

export default LogoutButton