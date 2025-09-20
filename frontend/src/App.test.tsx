import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders Photlas heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Photlas')
  })

  it('renders map area description', () => {
    render(<App />)
    expect(screen.getByText('地図表示エリア (Google Maps Platform)')).toBeInTheDocument()
  })

  it('renders all floating UI components', () => {
    render(<App />)
    // フローティング要素の確認
    expect(screen.getByRole('button', { name: 'フィルター' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'メニュー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument()
    expect(screen.getByTestId('category-buttons')).toBeInTheDocument()
  })
})
