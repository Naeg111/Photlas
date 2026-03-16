import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CookieConsentBanner } from './CookieConsentBanner'

const STORAGE_KEY = 'cookie_consent_acknowledged'

const mockStorage: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]) }),
  length: 0,
  key: vi.fn(),
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>
  )
}

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
    vi.stubGlobal('localStorage', mockLocalStorage)
  })

  it('初回訪問時にバナーが表示される', () => {
    renderBanner()

    expect(screen.getByTestId('cookie-consent-banner')).toBeInTheDocument()
    expect(screen.getByText(/Google Analytics/)).toBeInTheDocument()
  })

  it('プライバシーポリシーへのリンクが存在する', () => {
    renderBanner()

    expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
  })

  it('OKボタンが存在する', () => {
    renderBanner()

    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })

  it('OKボタンを押すとバナーが消える', () => {
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
  })

  it('OKボタンを押すとlocalStorageに保存される', () => {
    renderBanner()

    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true')
  })

  it('localStorageに同意済みが保存されている場合、バナーは表示されない', () => {
    mockStorage[STORAGE_KEY] = 'true'

    renderBanner()

    expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
  })
})
