import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'
import { useProfileEdit } from './useProfileEdit'

// sonnerのモック
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

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
    onUsernameUpdated: vi.fn(),
    onImageUpdated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('表示名編集', () => {
    it('handleUsernameEditClickで編集モードになり初期表示名がセットされる', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      expect(result.current.isEditingUsername).toBe(false)

      act(() => {
        result.current.handleUsernameEditClick()
      })

      expect(result.current.isEditingUsername).toBe(true)
      expect(result.current.editingUsername).toBe('testuser')
    })

    it('handleUsernameChangeで編集中の表示名が更新される', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        result.current.handleUsernameChange('newname')
      })

      expect(result.current.editingUsername).toBe('newname')
    })

    it('handleSaveUsernameで空の表示名の場合にエラーがセットされる', async () => {
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

      expect(result.current.usernameError).toBe('表示名を入力してください。')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('Issue#98 - handleSaveUsernameで12文字を超える表示名の場合にエラーがセットされる', async () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        // Issue#98 で長さ上限が 30 → 12 に変更された
        result.current.handleUsernameChange('a'.repeat(13))
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(result.current.usernameError).toBe('表示名は2文字以上12文字以内で入力してください。')
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
        json: () => Promise.resolve({ message: 'この表示名は既に使用されています' }),
      })
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })

      act(() => {
        // Issue#98: 12文字以内に収める（duplicatename → duplicate に短縮）
        result.current.handleUsernameChange('duplicate')
      })

      await act(async () => {
        await result.current.handleSaveUsername()
      })

      expect(result.current.usernameError).toBe('この表示名は既に使用されています')
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

    it('Issue#82 - handleCropCompleteでプレビューが表示されアップロードは実行されない', async () => {
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

      // アップロードは実行されない（保存ボタンで実行）
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handleCropCancelでトリミングモーダルが閉じる', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleCropCancel()
      })

      expect(result.current.isCropperOpen).toBe(false)
      expect(result.current.cropperImageSrc).toBe('')
    })

    it('Issue#82 - handleDeleteProfileImageでプレビューがリセットされAPIは呼ばれない', async () => {
      const onImageUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onImageUpdated })
      )

      await act(async () => {
        await result.current.handleDeleteProfileImage()
      })

      // プレビューがnull（デフォルトアバター）にリセットされる
      expect(onImageUpdated).toHaveBeenCalledWith(null)

      // APIは呼ばれない（保存ボタンで実行）
      expect(mockFetch).not.toHaveBeenCalled()

      // hasUnsavedChangesがtrue
      expect(result.current.hasUnsavedChanges).toBe(true)
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

      // Issue#100 / Issue#124 - S3 PUT に必要なヘッダが揃っていること
      // 呼び出し順: 1) presigned-url POST, 2) S3 PUT, 3) profile-image 登録 PUT
      const s3PutCall = mockFetch.mock.calls[1]
      expect(s3PutCall[0]).toBe('https://s3.example.com/upload')
      const s3PutInit = s3PutCall[1] as RequestInit
      expect(s3PutInit.method).toBe('PUT')
      const s3PutHeaders = s3PutInit.headers as Record<string, string>
      // Issue#100: presigned URL の署名と整合させるため必須
      expect(s3PutHeaders['x-amz-tagging']).toBe('status=pending')
      // Issue#124: 同上、署名対象に含まれているため必須
      expect(s3PutHeaders['Cache-Control']).toBe('public, max-age=31536000, immutable')
    })

    it('レポート#5-3 - handleSaveAllChangesでS3 PUTが失敗した場合にエラートーストが表示される', async () => {
      mockFetch
        // 署名付きURL取得: 成功
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', objectKey: 'profiles/test-key.jpg' }),
        })
        // S3 PUT: 失敗
        .mockResolvedValueOnce({ ok: false, status: 500 })

      const { result } = renderHook(() => useProfileEdit(defaultProps))

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      // エラートーストが表示される
      expect(toast.error).toHaveBeenCalledWith('プロフィール画像の登録に失敗しました')

      // pendingImageBlobが保持される（クリアされない）
      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('レポート#5-3 - handleSaveAllChangesでバックエンドPUTが失敗した場合にエラートーストが表示される', async () => {
      mockFetch
        // 署名付きURL取得: 成功
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', objectKey: 'profiles/test-key.jpg' }),
        })
        // S3 PUT: 成功
        .mockResolvedValueOnce({ ok: true })
        // バックエンド画像キー登録PUT: 失敗
        .mockResolvedValueOnce({ ok: false, status: 500 })

      const { result } = renderHook(() => useProfileEdit(defaultProps))

      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })

      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      // エラートーストが表示される
      expect(toast.error).toHaveBeenCalledWith('プロフィール画像の登録に失敗しました')

      // pendingImageBlobが保持される（クリアされない）
      expect(result.current.hasUnsavedChanges).toBe(true)
    })

    it('Issue#102 - 画像アップロード失敗時も表示名の保存は続行される', async () => {
      mockFetch
        // 表示名保存: 成功
        .mockResolvedValueOnce({ ok: true })
        // 署名付きURL取得: 成功
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uploadUrl: 'https://s3.example.com/upload', objectKey: 'profiles/test-key.jpg' }),
        })
        // S3 PUT: 失敗
        .mockResolvedValueOnce({ ok: false, status: 500 })

      const onUsernameUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({ ...defaultProps, onUsernameUpdated })
      )

      // 表示名編集
      act(() => {
        result.current.handleUsernameEditClick()
      })
      act(() => {
        result.current.handleUsernameChange('newname')
      })

      // 画像クロップ
      const croppedBlob = new Blob(['cropped-data'], { type: 'image/jpeg' })
      await act(async () => {
        await result.current.handleCropComplete(croppedBlob)
      })

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      // 画像はエラー
      expect(toast.error).toHaveBeenCalledWith('プロフィール画像の登録に失敗しました')

      // 表示名の保存は完了している
      expect(onUsernameUpdated).toHaveBeenCalledWith('newname')
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

      // hook内部の状態のみリセットされる（onImageUpdatedは呼ばない）
      // ProfileDialogのクリーンアップeffectがUI状態をリセットする
      expect(onImageUpdated).toHaveBeenCalledTimes(1) // handleCropCompleteの1回のみ
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })

  describe('統一保存機能', () => {
    it('handleSaveAllChangesで表示名が保存される', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      const onUsernameUpdated = vi.fn()
      const { result } = renderHook(() =>
        useProfileEdit({
          ...defaultProps,
          onUsernameUpdated,
        })
      )

      act(() => {
        result.current.handleUsernameEditClick()
      })
      act(() => {
        result.current.handleUsernameChange('newname')
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      await act(async () => {
        await result.current.handleSaveAllChanges()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/users/me/username',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(onUsernameUpdated).toHaveBeenCalledWith('newname')
    })

    it('handleCancelAllChangesで表示名の編集状態がリセットされる', () => {
      const { result } = renderHook(() => useProfileEdit(defaultProps))

      act(() => {
        result.current.handleUsernameEditClick()
      })
      act(() => {
        result.current.handleUsernameChange('changed')
      })

      expect(result.current.hasUnsavedChanges).toBe(true)

      act(() => {
        result.current.handleCancelAllChanges()
      })

      expect(result.current.isEditingUsername).toBe(false)
      expect(result.current.editingUsername).toBe('testuser')
      expect(result.current.usernameError).toBe('')
      expect(result.current.hasUnsavedChanges).toBe(false)
    })
  })
})
