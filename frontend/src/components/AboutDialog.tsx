import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Search, LocateFixed } from "lucide-react";
import { CompassIcon } from "./CompassIcon";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: Readonly<AboutDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto py-10">
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
              Photlasは、地図から写真に出会えるサービスです。
            </p>
            <p className="mt-2">
              地図をスクロールするだけで、まだ知らない風景が次々と現れます。気になる場所を見つけたら、撮影地点をピンポイントで確認できるので、そのまま次の旅先にできます。
            </p>
            <p className="mt-2">
              地図を眺めているだけで、新しい行き先が見つかる。それがPhotlasです。
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">使い方</h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <span className="font-semibold">スポットを探す</span>
                <p className="ml-5 mt-1">
                  地図を動かして、気になるエリアのピンをタップしてみましょう。撮影された写真を、カメラの設定情報付きで確認できます。場所検索を使えば、地名や施設名で直接移動することもできます。撮影地点は、ミニマップをタップすると地図上に拡大表示され、周辺の地理関係をより確認しやすくなります。
                </p>
              </li>
              <li>
                <span className="font-semibold">フィルターで絞り込む</span>
                <p className="ml-5 mt-1">
                  左上のフィルターボタンから、ジャンル・撮影時期・時間帯・天候などの条件で絞り込めます。上級者向けフィルターでは、機材種別・焦点距離・ISO感度での絞り込みも可能です。
                </p>
              </li>
              <li>
                <span className="font-semibold">写真を投稿する</span>
                <p className="ml-5 mt-1">
                  アカウントを作成してログインすると、右下の「＋」ボタンから写真を投稿できます。写真にGPS情報が含まれていれば撮影地点が自動で設定され、含まれていなければ地図上で手動で指定できます。
                </p>
              </li>
              <li>
                <span className="font-semibold">お気に入りに保存する</span>
                <p className="ml-5 mt-1">
                  気になった写真はお気に入りに追加して、あとからまとめて見返すことができます。
                </p>
              </li>
              <li>
                <span className="font-semibold">プロフィールを充実させる</span>
                <p className="ml-5 mt-1">
                  プロフィール画像やSNSリンクを登録できます。あなたの写真に興味を持った人が、SNSを訪れてくれるかもしれません。
                </p>
              </li>
              <li>
                <span className="font-semibold">ホーム画面に追加する</span>
                <p className="ml-5 mt-1">
                  ブラウザからPhotlasをホーム画面やデスクトップに追加すると、全画面で快適に利用できます。タブレットなら大画面で地図と写真を楽しめます。
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">地図の操作について</h3>
            <ul className="space-y-3">
              <li>
                <p>
                  地図は2本指で操作することで、向きや角度を変更できます。
                </p>
              </li>
              <li className="flex items-start gap-2">
                <CompassIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">方位リセットボタン</span> — 地図の向きや角度を変更した場合に、北が上の状態にリセットします。
                </p>
              </li>
              <li className="flex items-start gap-2">
                <Search className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">場所検索ボタン</span> — 地名や施設名を入力して、地図をその場所に移動できます。
                </p>
              </li>
              <li className="flex items-start gap-2">
                <LocateFixed className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">現在位置ボタン</span> — 現在地を地図上に表示します。
                </p>
              </li>
            </ul>
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
