import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import type { ReactNode } from "react";

interface ScrollableInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** スクリーンリーダー用の説明（視覚的には非表示） */
  description: string;
  children: ReactNode;
}

/**
 * Issue#114: 情報系ダイアログの共通レイアウト
 *
 * 固定ヘッダー + スクロール可能なコンテンツ領域を提供する。
 * AboutDialog / HowToUseDialog / ContactDialog で共有。
 */
export function ScrollableInfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: Readonly<ScrollableInfoDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[80vh]"
        style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh' }}
      >
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl">{title}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
