import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'

/**
 * TermsOfServicePage コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 *
 * 利用規約を表示するダイアログ
 */

interface TermsOfServicePageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TermsOfServicePage({
  open,
  onOpenChange,
}: TermsOfServicePageProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>利用規約</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasの利用規約
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            <section>
              <h2 className="mb-3">第1条（適用）</h2>
              <p className="text-sm text-gray-700">
                本規約は、本サービスの提供条件及び本サービスの利用に関する当社とユーザーとの間の権利義務関係を定めることを目的とし、ユーザーと当社との間の本サービスの利用に関わる一切の関係に適用されます。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第2条（定義）</h2>
              <p className="text-sm text-gray-700 mb-2">
                本規約において使用する以下の用語は、各々以下に定める意味を有するものとします。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>「本サービス」とは、当社が提供する「Photlas」という名称のサービスを意味します。</li>
                <li>「ユーザー」とは、本規約に同意の上、本サービスを利用する全ての方を意味します。</li>
                <li>「投稿データ」とは、ユーザーが本サービスを利用して投稿その他送信したコンテンツを意味します。</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第3条（ユーザー登録）</h2>
              <p className="text-sm text-gray-700 mb-2">
                本サービスの利用を希望する方は、本規約を遵守することに同意し、当社の定める方法によってユーザー登録を申請するものとします。
              </p>
              <p className="text-sm text-gray-700">
                当社は、登録希望者が以下のいずれかの事由に該当する場合は、登録を拒否することがあります。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mt-2">
                <li>登録内容に虚偽の事項を届け出た場合</li>
                <li>過去に本規約違反等により登録を抹消されたことがある場合</li>
                <li>その他、当社が登録を相当でないと判断した場合</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第4条（投稿データの取扱い）</h2>
              <p className="text-sm text-gray-700 mb-2">
                ユーザーは、投稿データについて、自らが投稿その他送信することについての適法な権利を有していること、及び投稿データが第三者の権利を侵害していないことについて、当社に対し表明し、保証するものとします。
              </p>
              <p className="text-sm text-gray-700">
                ユーザーは、投稿データについて、当社に対し、世界的、非独占的、無償、サブライセンス可能かつ譲渡可能な使用、複製、配布、派生著作物の作成、表示及び実行に関するライセンスを付与します。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第5条（禁止事項）</h2>
              <p className="text-sm text-gray-700 mb-2">
                ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>当社、他のユーザー、またはその他第三者の権利を侵害する行為</li>
                <li>当社のサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                <li>本サービスによって得られた情報を商業的に利用する行為</li>
                <li>当社のサービスの運営を妨害するおそれのある行為</li>
                <li>不正アクセスをし、またはこれを試みる行為</li>
                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                <li>不正な目的を持って本サービスを利用する行為</li>
                <li>私有地への無断立ち入りを助長する行為</li>
                <li>その他、当社が不適切と判断する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第6条（本サービスの停止等）</h2>
              <p className="text-sm text-gray-700">
                当社は、以下のいずれかの事由があると判断した場合、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mt-2">
                <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
                <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
                <li>コンピュータまたは通信回線等が事故により停止した場合</li>
                <li>その他、当社が本サービスの提供が困難と判断した場合</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第7条（免責事項）</h2>
              <p className="text-sm text-gray-700 mb-2">
                当社は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
              </p>
              <p className="text-sm text-gray-700">
                当社の債務不履行責任は、当社の故意または重過失によらない場合には免責されるものとします。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第8条（準拠法・管轄裁判所）</h2>
              <p className="text-sm text-gray-700 mb-2">
                本規約の解釈にあたっては、日本法を準拠法とします。
              </p>
              <p className="text-sm text-gray-700">
                本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄裁判所とします。
              </p>
            </section>

            <section className="pt-6 border-t">
              <p className="text-sm text-gray-500">
                制定日：2025年1月1日<br />
                最終改定日：2025年1月1日
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
