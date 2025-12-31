import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSettingsDialog({
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>アカウント設定</DialogTitle>
          <DialogDescription className="sr-only">
            アカウント情報とセキュリティ設定
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* メールアドレス変更 */}
          <div className="space-y-3">
            <h3>メールアドレスの変更</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-email">��在のメールアドレス</Label>
                <Input
                  id="current-email"
                  type="email"
                  placeholder="current@example.com"
                  disabled
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="new-email">新しいメールアドレス</Label>
                <Input id="new-email" type="email" placeholder="new@example.com" className="mt-2" />
              </div>
              <Button className="w-full mt-2">メールアドレスを変更</Button>
            </div>
          </div>

          <Separator />

          {/* パスワード変更 */}
          <div className="space-y-3">
            <h3>パスワードの変更</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="current-password">現在のパスワード</Label>
                <Input id="current-password" type="password" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="new-password">新しいパスワード</Label>
                <Input id="new-password" type="password" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
                <Input id="confirm-password" type="password" className="mt-2" />
              </div>
              <Button className="w-full mt-2">パスワードを変更</Button>
            </div>
          </div>

          <Separator />

          {/* プラン確認 */}
          <div className="space-y-3">
            <h3>プラン</h3>
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-gray-500">現在のプラン</p>
              <p>無料プラン</p>
            </div>
            <Button variant="outline" className="w-full" disabled>
              プランをアップグレード（準備中）
            </Button>
          </div>

          <Separator />

          {/* アカウント削除 */}
          <div className="space-y-3 pt-2.5">
            <h3 className="text-red-600">アカウント削除</h3>
            <p className="text-sm text-gray-500">
              アカウントを削除すると、すべてのデータが完全に削除されます。この操作は取り消せません。
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  アカウントを削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。アカウントとすべてのデータが完全に削除されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                    削除する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}