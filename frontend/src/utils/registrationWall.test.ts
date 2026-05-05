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
  REGISTRATION_WALL_VIEW_LIMIT,
  VIEWED_PHOTO_IDS_STORAGE_KEY,
} from './registrationWall'

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

  describe('shouldShowRegistrationWall', () => {
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
  })
})
