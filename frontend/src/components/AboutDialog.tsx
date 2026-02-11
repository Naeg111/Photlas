import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Photlasとは？</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasのサービス説明
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h3 className="font-bold text-base mb-2">サービス概要</h3>
            <p>
              Photlasは、写真を通じて撮影スポットを共有・発見できるサービスです。
              地図上に投稿された写真のピンが表示され、
              どこでどんな写真が撮れるのかをひと目で確認できます。
            </p>
            <p className="mt-2">
              「あの場所ではどんな写真が撮れるんだろう？」「次の撮影スポットを探したい」
              ——そんな写真好きの方のために作られたサービスです。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">使い方</h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <span className="font-semibold">スポットを探す</span>
                <p className="ml-5 mt-1">
                  地図を移動・ズームして、気になるエリアのピンをタップしてみましょう。
                  投稿された写真や撮影情報を確認できます。
                </p>
              </li>
              <li>
                <span className="font-semibold">フィルターで絞り込む</span>
                <p className="ml-5 mt-1">
                  左上のフィルターボタンから、被写体の種類・季節・時間帯・天候などの条件で
                  スポットを絞り込めます。
                </p>
              </li>
              <li>
                <span className="font-semibold">写真を投稿する</span>
                <p className="ml-5 mt-1">
                  アカウントを作成してログインすると、右下の「＋」ボタンから写真を投稿できます。
                  撮影場所は写真のEXIF情報から自動で取得されます。
                </p>
              </li>
              <li>
                <span className="font-semibold">行きたい場所を保存する</span>
                <p className="ml-5 mt-1">
                  気になるスポットは「行きたい」ボタンで保存できます。
                  保存したスポットはメニューの「行きたい場所リスト」からいつでも確認できます。
                </p>
              </li>
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
