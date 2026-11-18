import { toast } from 'sonner'
import type { TFunction } from 'i18next'
import { translateErrorCode } from './apiErrorMessage'

/**
 * 通報 API（写真・プロフィール）の失敗を知らせ、通報ダイアログを閉じるべきかを返す。
 * 写真詳細とプロフィールの通報で扱いがずれないよう、ここにまとめる。
 *
 * - 409（すでに通報済み）: 利用者の目的は果たされているので、エラーではなくお知らせ（info）を出して閉じる
 * - 400（公開中でない写真・自分の投稿やプロフィールの通報、不正な理由など）: 失敗を知らせて閉じる
 *   （やり直しても通らないため）。エラーコードに翻訳があればその文言（例: PHOTO_NOT_PUBLIC）、
 *   無ければ汎用の「通報に失敗しました」を出す
 * - それ以外（500・通信エラーなど。status は null）: 失敗を知らせ、やり直せるよう開いたままにする
 *
 * レート制限（429）は呼び出し側で notifyIfRateLimited を先に使う。
 *
 * @param status HTTP ステータス。通信エラーなどで応答が無いときは null
 * @param code エラーレスポンスの code（Spec#93）。400 のときだけ使う
 * @returns ダイアログを閉じるべきなら true
 */
export function notifyReportFailure(status: number | null, t: TFunction, code?: string): boolean {
  if (status === 409) {
    toast.info(t('report.alreadyReported'))
    return true
  }
  if (status === 400) {
    toast.error(translateErrorCode(code, t, 'report.failed'))
    return true
  }
  toast.error(t('report.failed'))
  return false
}
