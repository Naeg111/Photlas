/**
 * Issue#118: 登録壁（Registration Wall）の閲覧履歴管理ユーティリティのテスト
 *
 * 注意: テスト全体の setup（src/test/setup.ts）で localStorage を vi.fn() でモック化しているため、
 *       本テスト内では Map ベースの実用的なストア実装で localStorage を上書きする。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getViewedPhotoIds,
  addViewedPhotoId,
  clearViewedPhotoIds,
  shouldShowRegistrationWall,
  hasValidAuthToken,
  REGISTRATION_WALL_VIEW_LIMIT,
  VIEWED_PHOTO_IDS_STORAGE_KEY,
} from './registrationWall'

/**
 * テスト用の JWT を生成するヘルパー。
 * header.payload.signature の形式で、payload は base64url エンコードされた JSON。
 * Issue#118 のフリッカー対策では payload.exp のみを参照するため、署名は適当な文字列でよい。
 */
function makeJwt(expUnixSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: expUnixSeconds }))
  return `${header}.${payload}.signature`
}

describe('registrationWall - Issue#118', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    Object.defineProperty(global, 'localStorage', {
      value: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
        clear: () => store.clear(),
        get length() {
          return store.size
        },
        key: (index: number) => Array.from(store.keys())[index] ?? null,
      },
      configurable: true,
      writable: true,
    })
  })

  describe('REGISTRATION_WALL_VIEW_LIMIT', () => {
    it('Issue#118 - 閾値は10件である', () => {
      expect(REGISTRATION_WALL_VIEW_LIMIT).toBe(10)
    })
  })

  describe('VIEWED_PHOTO_IDS_STORAGE_KEY', () => {
    it('Issue#118 - localStorage キーは photlas_viewed_photo_ids である', () => {
      expect(VIEWED_PHOTO_IDS_STORAGE_KEY).toBe('photlas_viewed_photo_ids')
    })
  })

  describe('getViewedPhotoIds', () => {
    it('Issue#118 - 何も保存されていなければ空配列を返す', () => {
      expect(getViewedPhotoIds()).toEqual([])
    })

    it('Issue#118 - 保存された配列を返す', () => {
      store.set(VIEWED_PHOTO_IDS_STORAGE_KEY, JSON.stringify([101, 102, 103]))
      expect(getViewedPhotoIds()).toEqual([101, 102, 103])
    })

    it('Issue#118 - 不正な JSON が保存されていれば空配列を返す（堅牢性）', () => {
      store.set(VIEWED_PHOTO_IDS_STORAGE_KEY, '{not valid json')
      expect(getViewedPhotoIds()).toEqual([])
    })

    it('Issue#118 - 配列でない値が保存されていれば空配列を返す（堅牢性）', () => {
      store.set(VIEWED_PHOTO_IDS_STORAGE_KEY, JSON.stringify({ foo: 'bar' }))
      expect(getViewedPhotoIds()).toEqual([])
    })

    it('Issue#118 - 配列内の数値以外の要素は除外される（堅牢性）', () => {
      store.set(
        VIEWED_PHOTO_IDS_STORAGE_KEY,
        JSON.stringify([101, 'string', 102, null, 103]),
      )
      expect(getViewedPhotoIds()).toEqual([101, 102, 103])
    })

    it('Issue#118 - localStorage 読み込みが例外を投げても空配列を返す（堅牢性）', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: () => {
            throw new Error('localStorage unavailable')
          },
          setItem: () => {},
          removeItem: () => {},
        },
        configurable: true,
        writable: true,
      })
      expect(getViewedPhotoIds()).toEqual([])
    })
  })

  describe('addViewedPhotoId', () => {
    it('Issue#118 - 新規IDを追加できる', () => {
      addViewedPhotoId(101)
      expect(getViewedPhotoIds()).toEqual([101])
    })

    it('Issue#118 - 既存IDは重複追加されない（冪等）', () => {
      addViewedPhotoId(101)
      addViewedPhotoId(101)
      addViewedPhotoId(101)
      expect(getViewedPhotoIds()).toEqual([101])
    })

    it('Issue#118 - 異なるIDは順次追加される', () => {
      addViewedPhotoId(101)
      addViewedPhotoId(102)
      addViewedPhotoId(103)
      expect(getViewedPhotoIds()).toEqual([101, 102, 103])
    })

    it('Issue#118 - 10件まで蓄積されるが11件目は追加されない（頭打ち）', () => {
      for (let i = 1; i <= 15; i++) {
        addViewedPhotoId(i)
      }
      expect(getViewedPhotoIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('Issue#118 - localStorage 書き込み失敗時もクラッシュしない（堅牢性）', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => {
            throw new Error('QuotaExceededError')
          },
          removeItem: () => {},
        },
        configurable: true,
        writable: true,
      })
      expect(() => addViewedPhotoId(101)).not.toThrow()
    })
  })

  describe('clearViewedPhotoIds', () => {
    it('Issue#118 - 保存済みリストをクリアできる', () => {
      addViewedPhotoId(101)
      addViewedPhotoId(102)
      clearViewedPhotoIds()
      expect(getViewedPhotoIds()).toEqual([])
    })

    it('Issue#118 - localStorage 書き込み失敗時もクラッシュしない（堅牢性）', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {
            throw new Error('storage error')
          },
        },
        configurable: true,
        writable: true,
      })
      expect(() => clearViewedPhotoIds()).not.toThrow()
    })
  })

  describe('hasValidAuthToken', () => {
    it('Issue#118 - localStorage/sessionStorage にトークンが無ければ false', () => {
      expect(hasValidAuthToken()).toBe(false)
    })

    it('Issue#118 - localStorage に有効期限内のトークンがあれば true', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 60 * 60 // 1時間後
      store.set('auth_token', makeJwt(futureExp))
      expect(hasValidAuthToken()).toBe(true)
    })

    it('Issue#118 - sessionStorage に有効期限内のトークンがあっても true', () => {
      const sessionStore = new Map<string, string>()
      const futureExp = Math.floor(Date.now() / 1000) + 60 * 60
      sessionStore.set('auth_token', makeJwt(futureExp))
      Object.defineProperty(global, 'sessionStorage', {
        value: {
          getItem: (key: string) => (sessionStore.has(key) ? sessionStore.get(key)! : null),
          setItem: (key: string, value: string) => {
            sessionStore.set(key, value)
          },
          removeItem: (key: string) => {
            sessionStore.delete(key)
          },
        },
        configurable: true,
        writable: true,
      })
      expect(hasValidAuthToken()).toBe(true)
    })

    it('Issue#118 - 期限切れのトークンなら false', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60 // 1分前
      store.set('auth_token', makeJwt(pastExp))
      expect(hasValidAuthToken()).toBe(false)
    })

    it('Issue#118 - 形式が壊れたトークンなら false（堅牢性）', () => {
      store.set('auth_token', 'not-a-jwt')
      expect(hasValidAuthToken()).toBe(false)
    })

    it('Issue#118 - payload が JSON でないトークンなら false（堅牢性）', () => {
      store.set('auth_token', `${btoa('header')}.${btoa('not-json')}.sig`)
      expect(hasValidAuthToken()).toBe(false)
    })

    it('Issue#118 - exp フィールドが無いトークンは false（保守的に未認証扱い）', () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const payload = btoa(JSON.stringify({ sub: 'user' }))
      store.set('auth_token', `${header}.${payload}.sig`)
      expect(hasValidAuthToken()).toBe(false)
    })

    it('Issue#118 - localStorage 読み込みが例外を投げても false（堅牢性）', () => {
      Object.defineProperty(global, 'localStorage', {
        value: {
          getItem: () => {
            throw new Error('localStorage unavailable')
          },
          setItem: () => {},
          removeItem: () => {},
        },
        configurable: true,
        writable: true,
      })
      expect(hasValidAuthToken()).toBe(false)
    })
  })

  describe('shouldShowRegistrationWall', () => {
    beforeEach(() => {
      Object.defineProperty(global, 'sessionStorage', {
        value: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
        configurable: true,
        writable: true,
      })
    })

    it('Issue#118 - ログイン中は常に false を返す', () => {
      for (let i = 1; i <= 20; i++) {
        addViewedPhotoId(i)
      }
      expect(shouldShowRegistrationWall(true)).toBe(false)
    })

    it('Issue#118 - 未ログインかつ閲覧0件なら false を返す', () => {
      expect(shouldShowRegistrationWall(false)).toBe(false)
    })

    it('Issue#118 - 未ログインかつ閲覧9件なら false を返す', () => {
      for (let i = 1; i <= 9; i++) {
        addViewedPhotoId(i)
      }
      expect(shouldShowRegistrationWall(false)).toBe(false)
    })

    it('Issue#118 - 未ログインかつ閲覧10件なら true を返す', () => {
      for (let i = 1; i <= 10; i++) {
        addViewedPhotoId(i)
      }
      expect(shouldShowRegistrationWall(false)).toBe(true)
    })

    it('Issue#118 - フリッカー対策: 引数 isLoggedIn=false でも localStorage に有効なトークンがあれば false', () => {
      // シナリオ: ログイン済みユーザーがリロードした直後の初回レンダリング。
      //   AuthContext の useEffect がまだ走っておらず isAuthenticated=false だが、
      //   localStorage には有効な JWT が残っている。閲覧履歴が10件以上あっても
      //   登録壁を出してはいけない（フリッカー防止）。
      for (let i = 1; i <= 10; i++) {
        addViewedPhotoId(i)
      }
      const futureExp = Math.floor(Date.now() / 1000) + 60 * 60
      store.set('auth_token', makeJwt(futureExp))
      expect(shouldShowRegistrationWall(false)).toBe(false)
    })

    it('Issue#118 - 期限切れトークンが残っていても閲覧10件なら true（実質ログアウト扱い）', () => {
      for (let i = 1; i <= 10; i++) {
        addViewedPhotoId(i)
      }
      const pastExp = Math.floor(Date.now() / 1000) - 60
      store.set('auth_token', makeJwt(pastExp))
      expect(shouldShowRegistrationWall(false)).toBe(true)
    })
  })
})
