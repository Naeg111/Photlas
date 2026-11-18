import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import i18n from '../i18n'
import { notifyReportFailure } from './notifyReportFailure'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}))

const t = i18n.t.bind(i18n)

describe('notifyReportFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('409（すでに通報済み）はお知らせ（info）を出し、ダイアログを閉じる', () => {
    expect(notifyReportFailure(409, t)).toBe(true)
    expect(toast.info).toHaveBeenCalledWith('すでに通報済みです')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('400 は失敗を知らせ、ダイアログを閉じる', () => {
    expect(notifyReportFailure(400, t)).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('通報に失敗しました')
  })

  it('Spec#93: 400 でエラーコードに翻訳があれば、その文言を出してダイアログを閉じる', () => {
    expect(notifyReportFailure(400, t, 'PHOTO_NOT_PUBLIC')).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('この写真は公開中ではないため操作できません')
  })

  it('Spec#93: 400 で翻訳の無いコード（VALIDATION_ERROR など）は汎用の文言を出す', () => {
    expect(notifyReportFailure(400, t, 'VALIDATION_ERROR')).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('通報に失敗しました')
  })

  it('Spec#93: 英語の設定では、400 のエラーコードの文言も英語で出す', async () => {
    await i18n.changeLanguage('en')
    try {
      expect(notifyReportFailure(400, t, 'PHOTO_NOT_PUBLIC')).toBe(true)
      expect(toast.error).toHaveBeenCalledWith('This photo is not public, so this action is unavailable.')
    } finally {
      await i18n.changeLanguage('ja')
    }
  })

  it('500 は失敗を知らせ、やり直せるようダイアログを開いたままにする', () => {
    expect(notifyReportFailure(500, t)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('通報に失敗しました')
  })

  it('500 では code があっても汎用の文言を出す（開いたままにしてやり直せるようにする）', () => {
    expect(notifyReportFailure(500, t, 'INTERNAL_ERROR')).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('通報に失敗しました')
  })

  it('通信エラー（status なし）は失敗を知らせ、ダイアログを開いたままにする', () => {
    expect(notifyReportFailure(null, t)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('通報に失敗しました')
  })
})
