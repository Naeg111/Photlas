/**
 * Issue#118: 登録壁の GA4 イベント送信ユーティリティのテスト
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  trackRegistrationWallEvent,
  type RegistrationWallEvent,
} from './registrationWallAnalytics'

describe('registrationWallAnalytics - Issue#118', () => {
  let mockGtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockGtag = vi.fn()
    vi.stubGlobal('gtag', mockGtag)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('trackRegistrationWallEvent', () => {
    it('Issue#118 - registration_wall_shown を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_shown')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_shown')
    })

    it('Issue#118 - registration_wall_signup_click を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_signup_click')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_signup_click')
    })

    it('Issue#118 - registration_wall_login_click を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_login_click')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_login_click')
    })

    it('Issue#118 - registration_wall_about_click を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_about_click')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_about_click')
    })

    it('Issue#118 - registration_wall_signup_success を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_signup_success')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_signup_success')
    })

    it('Issue#118 - registration_wall_login_success を送信できる', () => {
      trackRegistrationWallEvent('registration_wall_login_success')
      expect(mockGtag).toHaveBeenCalledWith('event', 'registration_wall_login_success')
    })

    it('Issue#118 - gtag が未定義でもエラーにならない（堅牢性）', () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('gtag', undefined)
      expect(() =>
        trackRegistrationWallEvent('registration_wall_shown'),
      ).not.toThrow()
    })

    it('Issue#118 - gtag が関数でなくてもエラーにならない（堅牢性）', () => {
      vi.unstubAllGlobals()
      vi.stubGlobal('gtag', 'not a function')
      expect(() =>
        trackRegistrationWallEvent('registration_wall_shown'),
      ).not.toThrow()
    })

    it('Issue#118 - 型チェック: RegistrationWallEvent は6つのイベント名のみ受け付ける', () => {
      // TypeScript コンパイル時に検証される。実行時は単に列挙された値を順番に呼ぶだけ。
      const events: RegistrationWallEvent[] = [
        'registration_wall_shown',
        'registration_wall_signup_click',
        'registration_wall_login_click',
        'registration_wall_about_click',
        'registration_wall_signup_success',
        'registration_wall_login_success',
      ]
      events.forEach((e) => trackRegistrationWallEvent(e))
      expect(mockGtag).toHaveBeenCalledTimes(events.length)
    })
  })
})
