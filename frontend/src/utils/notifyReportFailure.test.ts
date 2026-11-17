import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import { notifyReportFailure } from './notifyReportFailure'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn() },
}))

const t = (key: string) => `t:${key}`

describe('notifyReportFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('409（すでに通報済み）はお知らせ（info）を出し、ダイアログを閉じる', () => {
    expect(notifyReportFailure(409, t)).toBe(true)
    expect(toast.info).toHaveBeenCalledWith('t:report.alreadyReported')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('400 は失敗を知らせ、ダイアログを閉じる', () => {
    expect(notifyReportFailure(400, t)).toBe(true)
    expect(toast.error).toHaveBeenCalledWith('t:report.failed')
  })

  it('500 は失敗を知らせ、やり直せるようダイアログを開いたままにする', () => {
    expect(notifyReportFailure(500, t)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('t:report.failed')
  })

  it('通信エラー（status なし）は失敗を知らせ、ダイアログを開いたままにする', () => {
    expect(notifyReportFailure(null, t)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('t:report.failed')
  })
})
