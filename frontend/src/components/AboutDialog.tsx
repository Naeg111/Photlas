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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto py-10">
        <DialogHeader>
          <DialogTitle className="text-2xl">Photlasとは？</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasのサービス説明
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h3 className="font-bold text-base mb-2">サービス概要</h3>
            <p>
              Photlasは、写真を通じて撮影スポットを共有・発見できるサービスです。
              どこでどんな写真が撮れるのかをひと目で確認できます。
            </p>
            <p className="mt-2">
              地図と写真を眺めているだけで、まだ見ぬ風景との出会いが生まれます。
              写真をきっかけに新しい行き先を見つける。それがPhotlasの一番の魅力です。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">使い方</h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <span className="font-semibold">スポットを探す</span>
                <p className="ml-5 mt-1">
                  地図を移動・ズームして、気になるエリアにあるピンを選択してみましょう。
                  そこで投稿された写真を撮影情報付きで確認できます。
                </p>
              </li>
              <li>
                <span className="font-semibold">フィルターで絞り込む</span>
                <p className="ml-5 mt-1">
                  左上のフィルターボタンから、被写体の種類・季節・時間帯・天候などの条件で表示される投稿を絞り込めます。
                </p>
              </li>
              <li>
                <span className="font-semibold">写真を投稿する</span>
                <p className="ml-5 mt-1">
                  アカウントを作成してログインすると、画面右下の「＋」ボタンから写真を投稿できます。
                  撮影場所は写真のEXIF情報に位置情報が含まれている場合は自動で取得され、含まれていない場合は手動で設定します。
                </p>
              </li>
              <li>
                <span className="font-semibold">SNSアカウントを登録する</span>
                <p className="ml-5 mt-1">
                  アカウントプロフィールにSNSアカウントへのリンクを登録できます。
                  あなたの投稿を見て興味を持った人が、SNSを訪れるかもしれません。
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">お問い合わせ</h3>
            <p>
              ご意見・ご要望・不具合のご報告などは、下記メールアドレスまでお気軽にご連絡ください。
            </p>
            <p className="mt-2">
              <a
                href="mailto:support@photlas.jp"
                className="text-blue-600 underline hover:text-blue-800"
              >
                support@photlas.jp
              </a>
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
