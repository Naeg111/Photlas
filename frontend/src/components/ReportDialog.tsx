import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

/**
 * Issue#54: 通報ダイアログ
 */

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { reason: string; details?: string }) => void;
  isLoading: boolean;
}

const REPORT_REASONS = [
  { value: "ADULT_CONTENT", label: "成人向け" },
  { value: "VIOLENCE", label: "暴力的" },
  { value: "COPYRIGHT_INFRINGEMENT", label: "著作権侵害" },
  { value: "PRIVACY_VIOLATION", label: "プライバシー侵害" },
  { value: "SPAM", label: "スパム" },
  { value: "OTHER", label: "その他" },
];

const MAX_DETAILS_LENGTH = 300;

export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: ReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState<string>("");

  // ダイアログを閉じた時にフォームをリセット
  useEffect(() => {
    if (!open) {
      setSelectedReason("");
      setDetails("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (selectedReason) {
      onSubmit({
        reason: selectedReason,
        details: details || undefined,
      });
    }
  };

  const isOtherSelected = selectedReason === "OTHER";
  const isSubmitDisabled =
    !selectedReason || (isOtherSelected && !details) || isLoading;
  const isOverLimit = details.length > MAX_DETAILS_LENGTH;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>この投稿を通報</DialogTitle>
        <DialogDescription className="sr-only">
          不適切なコンテンツや問題のある投稿を通報
        </DialogDescription>

        <div className="space-y-4">
          {/* 通報理由選択 */}
          <div className="space-y-3">
            <Label>通報理由</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {REPORT_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={reason.value}
                    id={reason.value}
                  />
                  <Label
                    htmlFor={reason.value}
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
      </DialogContent>
    </Dialog>
  );
}
