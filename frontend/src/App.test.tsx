import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders Photlas heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Photlas')
  })

  it('renders application description', () => {
    render(<App />)
    expect(screen.getByText('写真投稿・位置情報共有アプリケーション')).toBeInTheDocument()
  })
})
