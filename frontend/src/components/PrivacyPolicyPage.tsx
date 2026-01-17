import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { ScrollArea } from './ui/scroll-area'

/**
 * PrivacyPolicyPage コンポーネント
 * Issue#27: パネル・ダイアログ群の移行
 *
 * プライバシーポリシーを表示するダイアログ
 */

interface PrivacyPolicyPageProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrivacyPolicyPage({
  open,
  onOpenChange,
}: PrivacyPolicyPageProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>プライバシーポリシー</DialogTitle>
          <DialogDescription className="sr-only">
            Photlasのプライバシーポリシー
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            <section>
              <p className="text-sm text-gray-700">
                Photlas運営（以下「当社」）は、本サービスにおけるユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第1条（個人情報）</h2>
              <p className="text-sm text-gray-700">
                「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、メールアドレス、その他の記述等により特定の個人を識別できる情報を指します。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第2条（個人情報の収集方法）</h2>
              <p className="text-sm text-gray-700 mb-2">
                当社は、ユーザーが利用登録をする際に、以下の個人情報をお尋ねすることがあります。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>氏名または表示名</li>
                <li>メールアドレス</li>
                <li>プロフィール画像</li>
                <li>SNSアカウント情報</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第3条（個人情報の利用目的）</h2>
              <p className="text-sm text-gray-700 mb-2">
                当社が個人情報を収集・利用する目的は、以下のとおりです。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>本サービスの提供・運営のため</li>
                <li>ユーザーからのお問い合わせに回答するため</li>
                <li>ユーザーが利用中のサービスの新機能、更新情報、キャンペーン等及び当社が提供する他のサービスの案内のメールを送付するため</li>
                <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
                <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
                <li>ユーザーにご自身の登録情報の閲覧や変更、削除、ご利用状況の閲覧を行っていただくため</li>
                <li>上記の利用目的に付随する目的</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第4条（利用目的の変更）</h2>
              <p className="text-sm text-gray-700">
                当社は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。利用目的の変更を行った場合には、変更後の目的について、当社所定の方法により、ユーザーに通知し、または本ウェブサイト上に公表するものとします。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第5条（個人情報の第三者提供）</h2>
              <p className="text-sm text-gray-700 mb-2">
                当社は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>法令に基づく場合</li>
                <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第6条（個人情報の開示）</h2>
              <p className="text-sm text-gray-700">
                当社は、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。ただし、開示することにより次のいずれかに該当する場合は、その全部または一部を開示しないこともあり、開示しない決定をした場合には、その旨を遅滞なく通知します。
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mt-2">
                <li>本人または第三者の生命、身体、財産その他の権利利益を害するおそれがある場合</li>
                <li>当社の業務の適正な実施に著しい支障を及ぼすおそれがある場合</li>
                <li>その他法令に違反することとなる場合</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3">第7条（個人情報の訂正および削除）</h2>
              <p className="text-sm text-gray-700">
                ユーザーは、当社の保有する自己の個人情報が誤った情報である場合には、当社が定める手続きにより、当社に対して個人情報の訂正、追加または削除（以下「訂正等」）を請求することができます。当社は、ユーザーから前項の請求を受けてその請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の訂正等を行うものとします。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第8条（個人情報の利用停止等）</h2>
              <p className="text-sm text-gray-700">
                当社は、本人から、個人情報が、利用目的の範囲を超えて取り扱われているという理由、または不正の手段により取得されたものであるという理由により、その利用の停止または消去（以下「利用停止等」）を求められた場合には、遅滞なく必要な調査を行います。調査結果に基づき、その請求に応じる必要があると判断した場合には、遅滞なく、当該個人情報の利用停止等を行います。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第9条（Cookie等の利用）</h2>
              <p className="text-sm text-gray-700">
                当社は、ユーザーによる本サービスの利用状況を把握するため、Cookie等の技術を使用することがあります。これにより収集した情報は、本サービスの改善や、ユーザーに最適化されたコンテンツの提供のために利用されます。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第10条（プライバシーポリシーの変更）</h2>
              <p className="text-sm text-gray-700">
                本ポリシーの内容は、法令その他本ポリシーに別段の定めのある事項を除いて、ユーザーに通知することなく、変更することができるものとします。当社が別途定める場合を除いて、変更後のプライバシーポリシーは、本ウェブサイトに掲載したときから効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="mb-3">第11条（お問い合わせ窓口）</h2>
              <p className="text-sm text-gray-700">
                本ポリシーに関するお問い合わせは、本サービス内のお問い合わせフォームよりお願いいたします。
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
