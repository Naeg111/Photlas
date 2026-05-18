/**
 * チップ・カード等で tag の displayName を表示するときに、末尾「全般」サフィックスを除去する。
 * 裏側のデータ (slug / tagId) は変えず、見た目だけ短縮する。
 *
 * 例: "野鳥全般" → "野鳥", "サクラ" → "サクラ"
 * 単独「全般」（2 文字ぴったり）は除去しない（空文字を避けるため）。
 */
export function formatTagDisplayName(displayName: string): string {
  if (displayName.length > 2 && displayName.endsWith('全般')) {
    return displayName.slice(0, -2)
  }
  return displayName
}
