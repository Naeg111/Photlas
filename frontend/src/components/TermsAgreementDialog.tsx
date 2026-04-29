/**
 * Issue#104: 利用規約・プライバシーポリシー同意ダイアログ
 *
 * <p>OAuth 経由の新規ユーザーが認証完了後に表示するダイアログ。
 * 利用規約とプライバシーポリシーへの同意を必須とし、両方チェックされるまで
 * 「利用を開始する」ボタンが活性化しない。
 *
 * <p>Phase A (Red) 段階：スタブ実装。Phase B (Green) で本実装を行う。
 */
interface TermsAgreementDialogProps {
  open: boolean
  /** 「利用を開始する」押下後の同意完了コールバック */
  onAgreed: () => void
  /** 「キャンセル」押下後のコールバック（呼び出し側でログアウト等を行う） */
  onCancelled: () => void
  /** 利用規約画面を表示する */
  onShowTerms: () => void
  /** プライバシーポリシー画面を表示する */
  onShowPrivacyPolicy: () => void
}

export default function TermsAgreementDialog(_props: TermsAgreementDialogProps) {
  // Phase A スタブ: 実装は Phase B で行う
  return null
}
