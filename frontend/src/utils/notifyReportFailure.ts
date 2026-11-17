import { toast } from 'sonner'

/** i18next TFunction の最小シグネチャ（テストで vi.fn() を渡せる形に留める） */
type TranslateFn = (key: string, options?: Record<string, unknown>) => string

/**
 * 通報 API（写真・プロフィール）の失敗を知らせ、通報ダイアログを閉じるべきかを返す。
 * 写真詳細とプロフィールの通報で扱いがずれないよう、ここにまとめる。
 *
 * - 409（すでに通報済み）: 利用者の目的は果たされているので、エラーではなくお知らせ（info）を出して閉じる
 * - 400（自分の投稿・プロフィールの通報、不正な理由など）: 失敗を知らせて閉じる（やり直しても通らないため）
 * - それ以外（500・通信エラーなど。status は null）: 失敗を知らせ、やり直せるよう開いたままにする
 *
 * レート制限（429）は呼び出し側で notifyIfRateLimited を先に使う。
 *
 * @param status HTTP ステータス。通信エラーなどで応答が無いときは null
 * @returns ダイアログを閉じるべきなら true
 */
export function notifyReportFailure(status: number | null, t: TranslateFn): boolean {
  if (status === 409) {
    toast.info(t('report.alreadyReported'))
    return true
  }
  if (status === 400) {
    toast.error(t('report.failed'))
    return true
  }
  toast.error(t('report.failed'))
  return false
}
