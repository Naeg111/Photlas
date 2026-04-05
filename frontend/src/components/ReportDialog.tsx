import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { REPORT_REASON_OPTIONS, REASON_OTHER } from "../utils/codeConstants";

/**
 * Issue#54: 通報ダイアログ
 */

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { reason: number; details?: string }) => void;
  isLoading: boolean;
}

const MAX_DETAILS_LENGTH = 300;

export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: Readonly<ReportDialogProps>) {
  const [selectedReason, setSelectedReason] = useState<number | null>(null);
  const [details, setDetails] = useState<string>("");

  // ダイアログを閉じた時にフォームをリセット
  useEffect(() => {
    if (!open) {
      setSelectedReason(null);
      setDetails("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (selectedReason !== null) {
      onSubmit({
        reason: selectedReason,
        details: details || undefined,
      });
    }
  };

  const isOtherSelected = selectedReason === REASON_OTHER;
  const isSubmitDisabled =
    selectedReason === null || (isOtherSelected && !details) || isLoading;
  const isOverLimit = details.length > MAX_DETAILS_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>この投稿を通報</DialogTitle>
            <DialogDescription className="sr-only">
              不適切なコンテンツや問題のある投稿を通報
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-4 mt-4">
          {/* 通報理由選択 */}
          <div className="space-y-3">
            <Label>通報理由</Label>
            <RadioGroup value={selectedReason !== null ? String(selectedReason) : ""} onValueChange={(val) => setSelectedReason(Number(val))}>
              {REPORT_REASON_OPTIONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={String(reason.value)}
                    id={String(reason.value)}
                  />
                  <Label
                    htmlFor={String(reason.value)}
                    className="font-normal cursor-pointer"
                  >
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* 詳細説明入力（「その他」選択時は必須、それ以外は任意） */}
          <div className="space-y-2">
            <Label htmlFor="details">
              詳細説明{isOtherSelected ? "（必須）" : "（任意）"}
            </Label>
            <Textarea
              id="details"
              placeholder="通報理由の詳細を入力してください（300文字以内）"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[100px]"
            />
            <div
              className={`text-sm text-right ${
                isOverLimit ? "text-red-500" : "text-gray-500"
              }`}
            >
              {details.length} / {MAX_DETAILS_LENGTH}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitDisabled || isOverLimit}
            >
              通報する
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
