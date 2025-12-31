/**
 * Issue#19: 報告機能 - 報告ダイアログ
 * Red段階: テスト実行用の空のスタブ
 */

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { reason: string; details: string }) => void;
  isLoading: boolean;
}

export function ReportDialog(_props: ReportDialogProps) {
  // Red段階: 空の実装
  return null;
}
