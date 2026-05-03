import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { AccountSettingsDialog } from './AccountSettingsDialog'

/**
 * Issue#108: アカウント設定ダイアログ - データエクスポート機能のテスト
 *
 * 範囲:
 *   - 「データのエクスポート」セクションが表示される
 *   - ボタン押下でパスワードを送信し POST /api/v1/users/me/export が呼ばれる
 *   - 200 OK: streamsaver.createWriteStream が呼ばれてダウンロードが開始される
 *   - 401: 「パスワードが正しくありません」エラー表示
 *   - 409: 「他の端末でエクスポートが進行中です」エラー表示
 *   - 429: 「次回ダウンロード可能日時」メッセージ表示
 *   - 5xx / ネットワークエラー: 汎用エラーメッセージ
 */

const CURRENT_EMAIL = 'naegi@example.com'
const MOCK_TOKEN = 'mock-token'
const VALID_PASSWORD = 'TestPass1'

// fetch API のモック
globalThis.fetch = vi.fn()

// sonner (toast) のモック
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

// react-router-dom の useNavigate モック
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// AuthContext のモック
const mockGetAuthToken = vi.fn()
const mockLogout = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getAuthToken: mockGetAuthToken,
    logout: mockLogout,
  }),
}))

// streamsaver のモック（ブラウザ専用 API なので jsdom では動かない）
// vi.mock のホイスト挙動に対応するため vi.hoisted で先行定義
const streamSaverMocks = vi.hoisted(() => {
  const writeFn = vi.fn()
  const closeFn = vi.fn()
  const abortFn = vi.fn()
  const createWriteStreamFn = vi.fn(() => ({
    getWriter: () => ({
      write: writeFn,
      close: closeFn,
      abort: abortFn,
      releaseLock: vi.fn(),
    }),
  }))
  return { writeFn, closeFn, abortFn, createWriteStreamFn }
})
const mockWritableStreamWrite = streamSaverMocks.writeFn
const mockWritableStreamClose = streamSaverMocks.closeFn
const mockCreateWriteStream = streamSaverMocks.createWriteStreamFn
vi.mock('streamsaver', () => ({
  default: { createWriteStream: streamSaverMocks.createWriteStreamFn },
  createWriteStream: streamSaverMocks.createWriteStreamFn,
}))

const Wrapped = ({ open = true }: { open?: boolean }) => (
  <BrowserRouter>
    <AccountSettingsDialog
      open={open}
      onOpenChange={() => {}}
      currentEmail={CURRENT_EMAIL}
    />
  </BrowserRouter>
)

/** ボディ付きの簡易レスポンスを 1 チャンクで返す ReadableStream を作る */
function makeBodyStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe('AccountSettingsDialog - データエクスポート (Issue#108)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthToken.mockReturnValue(MOCK_TOKEN)
  })

  afterEach(() => {
    cleanup()
  })

  it('「データのエクスポート」セクションを表示する', () => {
    render(<Wrapped />)
    // 翻訳キー settings.exportData の値が表示される
    expect(screen.getByText(/データのエクスポート|Export Data|데이터 내보내기|数据导出/i))
        .toBeInTheDocument()
    expect(screen.getByRole('button', { name: /データをダウンロード|Download Data|다운로드|下载数据/i }))
        .toBeInTheDocument()
  })

  it('パスワードを入力しないでダウンロードボタンを押すとエラー表示', () => {
    render(<Wrapped />)
    const button = screen.getByRole('button', { name: /データをダウンロード|Download/i })
    fireEvent.click(button)

    expect(mockToastError).toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('パスワード入力で POST /api/v1/users/me/export が呼ばれる', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: makeBodyStream(new Uint8Array([0x50, 0x4b])), // "PK" header
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="photlas-export-1-2026-05-03_05-30-00Z.zip"' }),
    })

    render(<Wrapped />)
    const passwordInput = screen.getByLabelText(/エクスポート用|Export Password/i) as HTMLInputElement
    fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
    const button = screen.getByRole('button', { name: /データをダウンロード|Download/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/export'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${MOCK_TOKEN}`,
          }),
          body: JSON.stringify({ password: VALID_PASSWORD }),
        }),
      )
    })
  })

  it('200 OK: streamsaver でダウンロードが開始される', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: makeBodyStream(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
      headers: new Headers({ 'Content-Disposition': 'attachment; filename="photlas-export-1-2026-05-03_05-30-00Z.zip"' }),
    })

    render(<Wrapped />)
    const passwordInput = screen.getByLabelText(/エクスポート用|Export Password/i) as HTMLInputElement
    fireEvent.change(passwordInput, { target: { value: VALID_PASSWORD } })
    fireEvent.click(screen.getByRole('button', { name: /データをダウンロード|Download/i }))

    await waitFor(() => {
      expect(mockCreateWriteStream).toHaveBeenCalledWith(
        expect.stringMatching(/^photlas-export-/),
      )
      expect(mockWritableStreamWrite).toHaveBeenCalled()
      expect(mockWritableStreamClose).toHaveBeenCalled()
    })
  })

  it('401: 「パスワードが正しくありません」エラー表示', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
    })

    render(<Wrapped />)
    fireEvent.change(
      screen.getByLabelText(/エクスポート用|Export Password/i),
      { target: { value: 'wrong' } },
    )
    fireEvent.click(screen.getByRole('button', { name: /データをダウンロード|Download/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/パスワードが正しくありません|wrong password|incorrect/i),
      )
    })
    expect(mockCreateWriteStream).not.toHaveBeenCalled()
  })

  it('409: 「他の端末でエクスポートが進行中」エラー表示', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      headers: new Headers(),
    })

    render(<Wrapped />)
    fireEvent.change(
      screen.getByLabelText(/エクスポート用|Export Password/i),
      { target: { value: VALID_PASSWORD } },
    )
    fireEvent.click(screen.getByRole('button', { name: /データをダウンロード|Download/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/他の端末|in progress|진행 중|进行中/i),
      )
    })
  })

  it('429: 「次回ダウンロード可能日時」メッセージ + Retry-After ヘッダーを反映', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '3600' }), // 1 時間後
    })

    render(<Wrapped />)
    fireEvent.change(
      screen.getByLabelText(/エクスポート用|Export Password/i),
      { target: { value: VALID_PASSWORD } },
    )
    fireEvent.click(screen.getByRole('button', { name: /データをダウンロード|Download/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/次回ダウンロード可能|next download available/i),
      )
    })
  })

  it('5xx: 汎用エラーメッセージ', async () => {
    const mockFetch = globalThis.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    })

    render(<Wrapped />)
    fireEvent.change(
      screen.getByLabelText(/エクスポート用|Export Password/i),
      { target: { value: VALID_PASSWORD } },
    )
    fireEvent.click(screen.getByRole('button', { name: /データをダウンロード|Download/i }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/ダウンロードに失敗|download failed|export failed/i),
      )
    })
  })
})
