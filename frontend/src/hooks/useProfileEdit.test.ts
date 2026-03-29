import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfileEdit } from './useProfileEdit'

// AuthContextのモック
const mockGetAuthToken = vi.fn(() => 'test-token')
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: mockGetAuthToken,
  }),
}))

// URL.createObjectURLのモック
const mockCreateObjectURL = vi.fn(() => 'blob:mock-preview-url')
global.URL.createObjectURL = mockCreateObjectURL

// fetch APIのモック
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

describe('useProfileEdit', () => {
  const defaultProps = {
    initialUsername: 'testuser',
    snsLinks: [] as { url: string; platform?: string }[],
    onUsernameUpdated: vi.fn(),
    onImageUpdated: vi.fn(),
    onSnsLinksUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('ユーザー名編集', () => {
    it('handleUsernameEditClickで編集モードになり初期ユーザー名がセットされる', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      expect(result.current.isEditingUsername).toBe(false)

      act(() => {
        result.current.handleUsernameEditClick()
      })

      expect(result.current.isEditingUsername).toBe(true)
      expect(result.current.editingUsername).toBe('testuser')
    })

    it('handleUsernameChangeで編集中のユーザー名が更新される', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('newname')
      })

      expect(result.current.editingUsername).toBe('newname')
    })

    it('handleSaveUsernameで空のユーザー名の場合にエラーがセットされる', async () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('')
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(result.current.usernameError).toBe('ユーザー名を入力してください')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handleSaveUsernameで30文字を超えるユーザー名の場合にエラーがセットされる', async () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('a'.repeat(31))
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(result.current.usernameError).toBe('30文字以内で入力してください')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handleSaveUsernameが正しいエンドポイントにPUTリクエストを送信する', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('validname')
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/users/me/username', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ username: 'validname' }),
      })
    })

    it('handleSaveUsernameで409コンフリクトの場合にエラーメッセージがセットされる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: 'このユーザー名は既に使用されています' }),
      })
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('duplicatename')
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(result.current.usernameError).toBe('このユーザー名は既に使用されています')
    })

    it('handleSaveUsername成功時にonUsernameUpdatedコールバックが呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const onUsernameUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onUsernameUpdated })
      )

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('newname')
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(onUsernameUpdated).toHaveBeenCalledWith('newname')
      expect(result.current.isEditingUsername).toBe(false)
    })
  })

  describe('プロフィール画像', () => {
    it('handleProfileImageSelectでFileReaderを使いトリミングモーダルが開く', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      // FileReaderのモック
      const mockReadAsDataURL = vi.fn()
      const mockFileReader = {
        readAsDataURL: mockReadAsDataURL,
        onload: null as (() => void) | null,
        result: 'data:image/jpeg;base64,test',
      }
      vi.spyOn(global, 'FileReader').mockImplementation(
        () => mockFileReader as unknown as FileReader
      )

      const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })
      const event = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>

      act(() => {
        result.current.handleProfileImageSelect(event)
      })

      expect(mockReadAsDataURL).toHaveBeenCalledWith(file)

      // onloadコールバックを発火
      act(() => {
        mockFileReader.onload?.()
      })

      expect(result.current.isCropperOpen).toBe(true)
      expect(result.current.cropperImageSrc).toBe('data:image/jpeg;base64,test')
    })

    it('handleCropCompleteでプレサインURLの取得とアップロードが行われる', async () => {
      // プレサインURL取得のレスポンス
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              uploadUrl: 'https://s3.example.com/upload',
              objectKey: 'profiles/test-key.jpg',
            }),
        })
        // S3へのアップロードレスポンス
        .mockResolvedValueOnce({ ok: true })
        // プロフィール画像URLの更新レスポンス
        .mockResolvedValueOnce({ ok: true })

      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      // プレビューURLが即座にコールバックに渡される
      expect(onImageUpdated).toHaveBeenCalledWith('blob:mock-preview-url')

      // プレサインURL取得（Authorizationヘッダー + extension/contentType body付き）
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/me/profile-image/presigned-url',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: expect.stringContaining('"extension"'),
        })
      )

      // S3へのアップロード
      expect(mockFetch).toHaveBeenCalledWith('https://s3.example.com/upload', {
        method: 'PUT',
        body: croppedBlob,
      })

      // プロフィール画像URLの更新（Authorizationヘッダー付き）
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/users/me/profile-image', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ objectKey: 'profiles/test-key.jpg' }),
      })
    })

    it('handleCropCancelでトリミングモーダルが閉じる', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleCropCancel()
      })

      expect(result.current.isCropperOpen).toBe(false)
      expect(result.current.cropperImageSrc).toBe('')
    })

    it('handleDeleteProfileImageでDELETE APIが呼ばれる', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      await act(async () => {
        await result.current.handleDeleteProfileImage()
      })

      expect(onImageUpdated).toHaveBeenCalledWith(null)
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/users/me/profile-image', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      })
    })

    // ============================================================
    // Issue#82: 画像の遅延アップロードフロー
    // ============================================================

    it('Issue#82 - handleCropCompleteでS3アップロードが実行されない（保存待ち）', async () => {
      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      // プレビューは表示される
      expect(onImageUpdated).toHaveBeenCalledWith('blob:mock-preview-url')

      // S3アップロードは実行されない
      expect(mockFetch).not.toHaveBeenCalled()

      // hasUnsavedChangesがtrueになる
      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('Issue#82 - handleSaveAllChangesで画像がアップロードされる', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', objectKey: 'profiles/test-key.jpg' }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true })

      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      // この時点ではアップロードされていない
      expect(mockFetch).not.toHaveBeenCalled()

      // 保存を実行
      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      // 保存後にアップロードが実行される
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/me/profile-image/presigned-url',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('Issue#82 - handleCancelAllChangesで画像変更がリバートされる', async () => {
      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      expect(onImageUpdated).toHaveBeenCalledWith('blob:mock-preview-url')

      // キャンセル
      act(() => {
        result.current.handleCancelAllChanges()
      })

      // プレビューがリセットされる
      expect(onImageUpdated).toHaveBeenCalledWith(null)
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })

  describe('SNSリンク', () => {
    it('handleStartEditSnsLinksで既存のリンクから初期化される', () => {
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: existingLinks })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      expect(result.current.isEditingSnsLinks).toBe(true)
      expect(result.current.editingSnsLinks).toEqual([
        expect.objectContaining({ platform: 'twitter', url: 'https://twitter.com/test' }),
      ])
    })

    it('handleStartEditSnsLinksで空の場合にデフォルトエントリが追加される', () => {
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: [] })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      expect(result.current.editingSnsLinks).toEqual([
        expect.objectContaining({ platform: 'twitter', url: '' }),
      ])
    })

    it('handleAddSnsLinkで新しいエントリが追加される（最大3件）', () => {
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: [] })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      // 初期状態で1件
      expect(result.current.editingSnsLinks).toHaveLength(1)

      act(() => {
        result.current.handleAddSnsLink()
      })
      expect(result.current.editingSnsLinks).toHaveLength(2)

      act(() => {
        result.current.handleAddSnsLink()
      })
      expect(result.current.editingSnsLinks).toHaveLength(3)

      // 最大3件なので4件目は追加されない
      act(() => {
        result.current.handleAddSnsLink()
      })
      expect(result.current.editingSnsLinks).toHaveLength(3)
    })

    it('handleRemoveSnsLinkで指定インデックスのエントリが削除される', () => {
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
        { platform: 'instagram', url: 'https://instagram.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: existingLinks })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })
      expect(result.current.editingSnsLinks).toHaveLength(2)

      act(() => {
        result.current.handleRemoveSnsLink(0)
      })

      expect(result.current.editingSnsLinks).toHaveLength(1)
      expect(result.current.editingSnsLinks[0].platform).toBe('instagram')
    })

    it('handleUpdateSnsLinkで指定インデックスのフィールドが更新される', () => {
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: existingLinks })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      act(() => {
        result.current.handleUpdateSnsLink(0, 'url', 'https://twitter.com/updated')
      })

      expect(result.current.editingSnsLinks[0].url).toBe(
        'https://twitter.com/updated'
      )

      act(() => {
        result.current.handleUpdateSnsLink(0, 'platform', 'instagram')
      })

      expect(result.current.editingSnsLinks[0].platform).toBe('instagram')
    })

    it('handleSaveSnsLinksでURLが空でないリンクのみPUTリクエストが送信される', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const onSnsLinksUpdated = vi.fn()
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
        { platform: 'instagram', url: '' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({
          ...defaultProps,
          snsLinks: existingLinks,
          onSnsLinksUpdated,
        })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      await act(async () => {
        await result.current.handleSaveSnsLinks()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/users/me/sns-links', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({
          snsLinks: [{ platform: 'twitter', url: 'https://twitter.com/test' }],
        }),
      })
      expect(onSnsLinksUpdated).toHaveBeenCalledWith([
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ])
    })

    it('handleCancelEditSnsLinksで編集状態がリセットされる', () => {
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, snsLinks: existingLinks })
      )

      act(() => {
        result.current.handleStartEditSnsLinks()
      })
      expect(result.current.isEditingSnsLinks).toBe(true)

      act(() => {
        result.current.handleCancelEditSnsLinks()
      })

      expect(result.current.isEditingSnsLinks).toBe(false)
      expect(result.current.editingSnsLinks).toEqual([])
    })
  })

  describe('統一保存機能', () => {
    it('handleSaveAllChangesでユーザー名とSNSリンクが一括保存される', async () => {
      // ユーザー名保存のレスポンス
      mockFetch
        .mockResolvedValueOnce({ ok: true })
        // SNSリンク保存のレスポンス
        .mockResolvedValueOnce({ ok: true })

      const onUsernameUpdated = vi.fn()
      const onSnsLinksUpdated = vi.fn()
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({
          ...defaultProps,
          snsLinks: existingLinks,
          onUsernameUpdated,
          onSnsLinksUpdated,
        })
      )

      // ユーザー名編集を開始
      act(() => {
        result.current.handleUsernameEditClick()
      })
      act(() => {
        result.current.handleUsernameChange('newname')
      })

      // SNSリンク編集を開始
      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      // ユーザー名のPUTリクエスト
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/me/username',
        expect.objectContaining({ method: 'PUT' })
      )
      // SNSリンクのPUTリクエスト
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/me/sns-links',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(onUsernameUpdated).toHaveBeenCalledWith('newname')
      expect(onSnsLinksUpdated).toHaveBeenCalled()
    })

    it('handleCancelAllChangesで全ての編集状態がリセットされる', () => {
      const existingLinks = [
        { platform: 'twitter', url: 'https://twitter.com/test' },
      ]
      const { result } = renderHook(() =>
        useProfileEdit({
          ...defaultProps,
          snsLinks: existingLinks,
        })
      )

      // ユーザー名編集を開始
      act(() => {
        result.current.handleUsernameEditClick()
      })
      act(() => {
        result.current.handleUsernameChange('changed')
      })

      // SNSリンク編集を開始
      act(() => {
        result.current.handleStartEditSnsLinks()
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      act(() => {
        result.current.handleCancelAllChanges()
      })

      expect(result.current.isEditingUsername).toBe(false)
      expect(result.current.editingUsername).toBe('testuser')
      expect(result.current.usernameError).toBe('')
      expect(result.current.isEditingSnsLinks).toBe(false)
      expect(result.current.editingSnsLinks).toEqual([])
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })
})
