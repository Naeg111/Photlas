import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CookieConsentBanner } from './CookieConsentBanner'
import i18n from '../i18n'

/**
 * Issue#71: GDPR対応 Cookie同意バナーテスト
 */

const CONSENT_KEY = 'cookie_consent'

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
  const result = render(
    <MemoryRouter>
      <CookieConsentBanner />
    </MemoryRouter>
  )
  // 500ms遅延表示のタイマーを進める
  act(() => { vi.advanceTimersByTime(500) })
  return result
}

describe('CookieConsentBanner - Issue#71 GDPR対応', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
    vi.stubGlobal('localStorage', mockLocalStorage)
    // gtag モック
    vi.stubGlobal('gtag', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('バナー表示', () => {
    it('初回訪問時にバナーが表示される', () => {
      renderBanner()

      expect(screen.getByTestId('cookie-consent-banner')).toBeInTheDocument()
    })

    it('日本語の説明文が表示される', () => {
      renderBanner()

      expect(screen.getByText(/Cookieによるアクセス情報/)).toBeInTheDocument()
    })

    // Spec#93 追加対応: 多言語化の前に入れた英文の併記（Spec#71）は、表示言語に関係なく出ていたので削除した
    it('日本語の設定では、英文を併記しない', () => {
      renderBanner()

      expect(screen.queryByText(/This site uses Google Analytics/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Privacy Policy' })).not.toBeInTheDocument()
    })

    it('プライバシーポリシーへのリンクが存在する', () => {
      renderBanner()

      expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
    })

    it('プライバシーポリシーリンクをクリックするとonPrivacyPolicyClickが呼ばれる', () => {
      const mockOnPrivacyPolicyClick = vi.fn()
      render(
        <MemoryRouter>
          <CookieConsentBanner onPrivacyPolicyClick={mockOnPrivacyPolicyClick} />
        </MemoryRouter>
      )
      act(() => { vi.advanceTimersByTime(500) })

      fireEvent.click(screen.getByText('プライバシーポリシー'))

      expect(mockOnPrivacyPolicyClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Spec#93 追加対応: 表示言語', () => {
    it.each(['ja', 'en', 'ko', 'zh-CN', 'zh-TW'])(
      '%s の設定では、その言語の説明文とリンクが 1 回だけ表示される',
      async (lng) => {
        await i18n.changeLanguage(lng)
        try {
          renderBanner()

          const text = screen.getByTestId('cookie-consent-banner').textContent ?? ''
          expect(text.split(i18n.t('cookie.message')).length - 1).toBe(1)
          expect(screen.getAllByRole('button', { name: i18n.t('cookie.privacyLink') })).toHaveLength(1)
          expect(screen.getByRole('button', { name: i18n.t('cookie.accept') })).toBeInTheDocument()
          expect(screen.getByRole('button', { name: i18n.t('cookie.decline') })).toBeInTheDocument()
          expect(text).not.toContain('This site uses Google Analytics and cookies')
        } finally {
          await i18n.changeLanguage('ja')
        }
      }
    )

    it('英語の設定では、説明文とボタンが英語で表示される', async () => {
      await i18n.changeLanguage('en')
      try {
        renderBanner()

        expect(screen.getAllByText(/This site uses Google Analytics/)).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Privacy Policy' })).toHaveLength(1)
        expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument()
        expect(screen.queryByText(/Cookieによるアクセス情報/)).not.toBeInTheDocument()
      } finally {
        await i18n.changeLanguage('ja')
      }
    })
  })

  describe('ボタン表示', () => {
    it('「同意する / Accept」ボタンが表示される', () => {
      renderBanner()

      expect(screen.getByRole('button', { name: /同意する/ })).toBeInTheDocument()
    })

    it('「拒否する / Decline」ボタンが表示される', () => {
      renderBanner()

      expect(screen.getByRole('button', { name: /拒否する/ })).toBeInTheDocument()
    })
  })

  describe('同意操作', () => {
    it('「同意する」を押すとバナーが消える', () => {
      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /同意する/ }))

      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
    })

    it('「同意する」を押すとlocalStorageにacceptedが保存される', () => {
      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /同意する/ }))

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(CONSENT_KEY, 'accepted')
    })

    it('「同意する」を押すとGA4のConsent Modeがgrantedに更新される', () => {
      const mockGtag = vi.fn()
      vi.stubGlobal('gtag', mockGtag)

      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /同意する/ }))

      expect(mockGtag).toHaveBeenCalledWith('consent', 'update', {
        analytics_storage: 'granted',
      })
    })
  })

  describe('拒否操作', () => {
    it('「拒否する」を押すとバナーが消える', () => {
      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /拒否する/ }))

      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
    })

    it('「拒否する」を押すとlocalStorageにdeclinedが保存される', () => {
      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /拒否する/ }))

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(CONSENT_KEY, 'declined')
    })

    it('「拒否する」を押してもGA4のConsent Modeは更新されない', () => {
      const mockGtag = vi.fn()
      vi.stubGlobal('gtag', mockGtag)

      renderBanner()

      fireEvent.click(screen.getByRole('button', { name: /拒否する/ }))

      expect(mockGtag).not.toHaveBeenCalled()
    })
  })

  describe('同意状態の復元', () => {
    it('accepted保存済みの場合バナーは表示されない', () => {
      mockStorage[CONSENT_KEY] = 'accepted'

      renderBanner()

      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
    })

    it('declined保存済みの場合バナーは表示されない', () => {
      mockStorage[CONSENT_KEY] = 'declined'

      renderBanner()

      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument()
    })
  })
})
