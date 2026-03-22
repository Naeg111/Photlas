/**
 * PrivacyContentJa コンポーネント
 * Issue#52: プライバシーポリシーの文面（日本語）
 *
 * プライバシーポリシーの本文コンテンツを提供する
 */
export function PrivacyContentJa() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          Photlas運営（以下「運営者」）は、本サービス「Photlas」（以下「本サービス」）におけるユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。運営者は、個人情報の保護に関する法律（個人情報保護法）その他の関係法令を遵守し、ユーザーの個人情報を適切に取り扱います。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第1条（基本方針）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者は、個人情報の保護を重要な責務と認識し、個人情報保護法その他の関係法令およびガイドラインを遵守するとともに、本ポリシーに従い個人情報を適正に取り扱います。本ポリシーは、本サービス（photlas.jp）における個人情報の取り扱いについて定めるものです。
        </p>
        <p className="text-sm text-gray-700">
          本ポリシーにおいて「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれるメールアドレス、ユーザー名その他の記述等により特定の個人を識別できる情報を指します。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第2条（収集する情報）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者は、本サービスの提供にあたり、以下の情報を収集します。
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（1）アカウント情報</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>メールアドレス</li>
          <li>ユーザー名</li>
          <li>パスワード（暗号化して保存します）</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（2）プロフィール情報</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>プロフィール画像</li>
          <li>SNSアカウントリンク（最大3件）</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（3）投稿データ</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>写真ファイル</li>
          <li>タイトル、施設名、タグ、カテゴリ、天気情報</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（4）写真メタデータ（EXIF情報）</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>撮影日時</li>
          <li>GPS座標（緯度・経度）</li>
          <li>撮影方向</li>
          <li>カメラ本体名</li>
          <li>レンズ名</li>
          <li>焦点距離、F値、シャッタースピード、ISO感度</li>
          <li>画像サイズ</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（5）位置情報</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>撮影地点のGPS座標（写真のEXIF情報から自動取得、またはユーザーによる手動入力）</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（6）利用データ</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>お気に入り登録情報</li>
          <li>通報情報（通報理由、通報対象）</li>
          <li>コンテンツモデレーション情報（審査結果、違反履歴、制裁情報）</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">（7）技術情報</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>IPアドレス（レートリミット制御目的で一時的に取得。永続的な保存は行いません）</li>
          <li>エラー情報（外部サービス「Sentry」を通じて収集。全エラーの一部のみが送信されます）</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第3条（情報の収集方法）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者は、以下の方法により情報を収集します。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>ユーザーが直接入力する情報（アカウント登録時、プロフィール編集時、写真投稿時）</li>
          <li>写真ファイルから自動的に抽出する情報（EXIF情報に含まれる撮影日時、GPS座標、カメラ情報等）</li>
          <li>サービス利用時に自動的に取得する情報（IPアドレス、エラー情報）</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第4条（情報の利用目的）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者が個人情報を収集・利用する目的は、以下のとおりです。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>本サービスの提供・運営・改善</li>
          <li>ユーザーの本人確認・認証</li>
          <li>写真の撮影地点をマップ上に表示する機能の提供</li>
          <li>写真の撮影情報（カメラ、レンズ、設定値等）の表示</li>
          <li>新機能・更新情報・メンテナンス等に関するユーザーへの通知</li>
          <li>パスワードリセットへの対応</li>
          <li>不正利用の検知・防止（レートリミット、不正アクセス防止）</li>
          <li>利用規約違反への対応</li>
          <li>本サービスの広告・宣伝・プロモーション（投稿データの利用）</li>
          <li>ユーザーからのお問い合わせへの対応</li>
          <li>上記の利用目的に付随する目的</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第5条（情報の保存・セキュリティ）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者は、収集した情報を以下の方法で安全に管理します。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>パスワードはBCryptにより暗号化（ハッシュ化）して保存し、運営者を含め誰も元のパスワードを閲覧できません。</li>
          <li>写真ファイルおよびプロフィール画像は、Amazon Web Services（AWS）のクラウドストレージに保存します。</li>
          <li>認証にはJSON Web Token（JWT）を使用し、トークンはユーザーのブラウザに保存されます。</li>
          <li>すべての通信はHTTPSにより暗号化して行います。</li>
          <li>不正アクセス防止のため、アクセス頻度の制限（レートリミット）を実施しています。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第6条（第三者提供・外部サービスの利用）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            運営者は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>法令に基づく場合</li>
              <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合であって、本人の同意を得ることが困難であるとき</li>
              <li>国の機関もしくは地方公共団体またはその委託を受けた者が法令の定める事務を遂行することに対して協力する必要がある場合であって、本人の同意を得ることにより当該事務の遂行に支障を及ぼすおそれがあるとき</li>
            </ul>
          </li>
          <li>
            運営者は、本サービスにかかる事業を他者に譲渡した場合、当該事業譲渡に伴い、個人情報を当該事業譲渡の譲受人に提供することがあります。
          </li>
          <li>
            運営者は、本サービスの提供にあたり、以下の外部サービスを利用しています。これらのサービスにユーザーの情報の一部が送信される場合があります。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <span className="font-semibold">Amazon Web Services（AWS S3、CloudFront、SES、Rekognition）</span>：画像ファイルの保存・配信、メール送信、およびコンテンツの自動審査に使用します。データはAWSの東京リージョン（ap-northeast-1）で処理されます。
              </li>
              <li>
                <span className="font-semibold">Mapbox</span>：地図の表示、撮影地点の位置情報の表示、および場所検索に使用します。Mapboxのプライバシーポリシーは
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">こちら</a>
                をご参照ください。
              </li>
              <li>
                <span className="font-semibold">Google Analytics 4</span>：サービス改善のためのアクセス解析に使用します。ページ閲覧数、利用状況等の匿名化されたデータを収集します。Googleのプライバシーポリシーは
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">こちら</a>
                をご参照ください。
              </li>
              <li>
                <span className="font-semibold">Sentry</span>：アプリケーションのエラー監視に使用します。エラー発生時に技術的なエラー情報が送信されます（全エラーの一部のみ）。Sentryのプライバシーポリシーは
                <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">こちら</a>
                をご参照ください。
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7条（EXIF情報の取り扱い）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            運営者は、ユーザーが投稿した写真ファイルに含まれるEXIF情報から、撮影日時、GPS座標、カメラ情報、レンズ情報、撮影設定値等を自動的に抽出します。
          </li>
          <li>
            抽出された撮影情報（カメラ名、レンズ名、焦点距離、F値、シャッタースピード、ISO感度等）は、本サービスのUI上で他のユーザーに表示されます。
          </li>
          <li>
            位置情報（GPS座標）は、撮影スポットとしてマップ上に表示されます。ユーザーは、写真投稿時に位置情報が本サービス上で公開されることを理解し、同意した上で投稿するものとします。
          </li>
          <li>
            本サービスでは、投稿時に写真ファイルからEXIF情報を自動的に削除した上でサーバーに保存します。ただし、ブラウザに表示される画像は技術的に保存される可能性があります。運営者は、画像データの完全な保護を保証するものではありません。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第8条（コンテンツの自動審査）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            運営者は、コンテンツポリシーの遵守を確保するため、ユーザーが投稿した写真について、AI技術（Amazon Rekognition Content Moderation）を用いた自動画像分析を実施します。
          </li>
          <li>
            自動審査では、投稿された画像が不適切なコンテンツ（性的表現、暴力的表現、児童の性的搾取等）に該当するかどうかを分析します。画像データはAWSの東京リージョンで処理され、分析結果のみが保存されます。
          </li>
          <li>
            自動審査により不適切と判断された投稿は、一時的に非公開（隔離）状態となり、運営者による人的確認が行われます。
          </li>
          <li>
            自動審査の結果および違反履歴は、コンテンツモデレーションおよびアカウント管理の目的で保存されます。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第9条（Cookie等の利用）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本サービスでは、認証目的でのCookieは使用しません。認証にはJSON Web Token（JWT）を使用し、以下の方法でブラウザに保存します。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>ログイン時に「ログインを記憶する」を選択した場合：localStorage（ブラウザを閉じても保持され、24時間有効）</li>
              <li>選択しない場合：sessionStorage（ブラウザを閉じると削除されます）</li>
            </ul>
          </li>
          <li>
            本サービスでは、Google Analytics 4を利用しており、Googleがアクセス情報の収集のためにCookieを使用する場合があります。収集されるデータは匿名化されており、個人を特定するものではありません。
          </li>
          <li>
            その他の外部サービス（Mapbox、Sentry等）が独自にCookieを使用する場合があります。これらのCookieの取り扱いについては、各サービスのプライバシーポリシーをご確認ください。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第10条（個人情報の開示・訂正・削除）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            ユーザーは、自身の個人情報について、以下の権利を有します。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>個人情報の開示を請求する権利</li>
              <li>個人情報の訂正、追加または削除を請求する権利</li>
              <li>個人情報の利用停止を請求する権利</li>
            </ul>
          </li>
          <li>
            上記の請求は、support@photlas.jp へのメールにて受け付けます。運営者は、本人確認を行った上で、合理的な期間内に対応いたします。
          </li>
          <li>
            プロフィール情報の一部（ユーザー名、プロフィール画像、SNSアカウントリンク）は、ユーザー自身で本サービス上から変更・削除することができます。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第11条（アカウント削除時のデータ取り扱い）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            ユーザーが退会した場合、以下のデータは不正利用の調査・対応を目的として90日間保持した後、バックアップを含め完全に削除します。ただし、利用規約に基づきプロモーション目的で既に公開された投稿データについてはこの限りではありません。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>アカウント情報（メールアドレス、ユーザー名等）</li>
              <li>プロフィール情報（プロフィール画像、SNSアカウントリンク）</li>
              <li>投稿データ（写真ファイル、メタデータ、タグ等）</li>
              <li>お気に入り・通報情報</li>
            </ul>
          </li>
          <li>
            削除後のデータの復旧はできません。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第12条（未成年者の利用）</h2>
        <p className="text-sm text-gray-700">
          未成年者が本サービスを利用する場合は、法定代理人（保護者）の同意を得た上で利用するものとします。未成年者が本サービスを利用した場合、法定代理人の同意を得ているものとみなします。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第13条（利用目的の変更）</h2>
        <p className="text-sm text-gray-700">
          運営者は、利用目的が変更前と関連性を有すると合理的に認められる場合に限り、個人情報の利用目的を変更するものとします。利用目的の変更を行った場合には、変更後の目的について、ユーザーに通知し、または本サービス上に公表するものとします。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第14条（プライバシーポリシーの変更）</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            運営者は、法令の改正やサービスの変更に伴い、本ポリシーを変更する場合があります。
          </li>
          <li>
            本ポリシーの重要な変更を行う場合は、事前にユーザーに通知するものとします。
          </li>
          <li>
            変更後のプライバシーポリシーは、本サービス上に掲載した時点から効力を生じるものとします。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第15条（個人データの処理の法的根拠）</h2>
        <p className="text-sm text-gray-700 mb-2">
          運営者は、以下の法的根拠に基づき個人データを処理します。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">同意</span>（GDPR第6条1項(a)）：Google Analytics 4によるアクセス解析。ユーザーはCookie同意バナーにより同意または拒否を選択できます。</li>
          <li><span className="font-semibold">契約の履行</span>（GDPR第6条1項(b)）：アカウント管理、サービス提供、地図機能（Mapbox）の提供。</li>
          <li><span className="font-semibold">正当な利益</span>（GDPR第6条1項(f)）：エラー監視（Sentry）、不正利用の検知・防止、サービスの安全性確保。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第16条（EU一般データ保護規則（GDPR）に基づく権利）</h2>
        <p className="text-sm text-gray-700 mb-2">
          欧州経済領域（EEA）に居住するユーザーは、GDPRに基づき以下の権利を有します。これらの権利の行使を希望する場合は、support@photlas.jp までご連絡ください。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">アクセス権</span>：ご自身の個人データのコピーを請求する権利</li>
          <li><span className="font-semibold">訂正権</span>：不正確な個人データの訂正を請求する権利</li>
          <li><span className="font-semibold">削除権（忘れられる権利）</span>：個人データの削除を請求する権利</li>
          <li><span className="font-semibold">処理の制限権</span>：個人データの処理の制限を請求する権利</li>
          <li><span className="font-semibold">データポータビリティ権</span>：個人データを構造化された機械可読な形式で受け取る権利</li>
          <li><span className="font-semibold">異議申立権</span>：正当な利益に基づく処理に対して異議を申し立てる権利</li>
          <li><span className="font-semibold">同意の撤回権</span>：同意に基づく処理について、いつでも同意を撤回する権利（ブラウザのlocalStorageをクリアすることでCookie同意を撤回できます）</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第17条（国際データ移転）</h2>
        <p className="text-sm text-gray-700 mb-2">
          ユーザーの個人データは、サービスの提供に必要な範囲で以下の地域に移転される場合があります。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">日本（AWS東京リージョン）</span>：画像ファイルの保存・配信、データベース、コンテンツ審査</li>
          <li><span className="font-semibold">米国</span>：Google Analytics 4によるアクセス解析データ、Sentryによるエラー監視データ</li>
        </ul>
        <p className="text-sm text-gray-700 mt-2">
          これらのサービス提供者は、それぞれのプライバシーポリシーおよびデータ処理契約に基づき、適切なデータ保護措置を講じています。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第18条（お問い合わせ窓口）</h2>
        <p className="text-sm text-gray-700">
          本ポリシーに関するお問い合わせは、以下の窓口までご連絡ください。
        </p>
        <p className="text-sm text-gray-700 mt-2">
          運営者名：Photlas運営<br />
          メールアドレス：support@photlas.jp
        </p>
      </section>

      <section className="pt-6 border-t">
        <p className="text-sm text-gray-500">
          制定日：2026年2月16日<br />
          最終改定日：2026年3月22日
        </p>
      </section>
    </div>
  )
}
