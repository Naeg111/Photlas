/**
 * TermsContentZhTW コンポーネント
 * Issue#101: 服務條款本文 (繁體中文)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 */
export function TermsContentZhTW() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          本服務條款(以下簡稱「本條款」)旨在規定 Photlas 營運方(以下簡稱「營運方」)提供的服務「Photlas」(以下簡稱「本服務」)的提供條件以及與本服務的使用相關的營運方與使用者之間的權利義務關係。在使用本服務前,請仔細閱讀本條款。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第1條 (適用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本條款旨在規定本服務的提供條件以及與本服務的使用相關的營運方與使用者之間的權利義務關係,並適用於使用者與營運方之間所有與本服務使用相關的關係。
          </li>
          <li>
            使用者使用本服務即視為同意本條款的所有條項。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第2條 (定義)</h2>
        <p className="text-sm text-gray-700 mb-2">
          本條款中使用的以下用語分別具有以下規定的含義。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>「本服務」是指營運方提供的名為「Photlas」(photlas.jp)的網路服務。</li>
          <li>「使用者」是指同意本條款後使用本服務的所有人。</li>
          <li>「註冊使用者」是指在本服務上完成帳戶註冊的使用者。</li>
          <li>
            「投稿資料」是指使用者使用本服務投稿或以其他方式傳送的內容,包括但不限於以下內容。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>照片檔案</li>
              <li>拍攝中繼資料(位置資訊、拍攝日期時間、相機資訊、鏡頭資訊、拍攝設定值等)</li>
              <li>標題、設施名稱、分類選擇、天氣資訊</li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第3條 (使用者註冊)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            {/* Issue#105: 13歲以上的使用限制 (與隱私政策第12條整合) */}
            本服務面向<span className="font-semibold">年滿 13歲</span>的使用者提供。未滿 13歲的人不能進行使用者註冊及本服務的使用。
          </li>
          <li>
            希望使用本服務部分功能的人,需同意遵守本條款,按營運方規定的方法申請使用者註冊。註冊需要輸入電子郵件、顯示名稱及密碼。
          </li>
          <li>
            使用者應保持註冊資訊準確且最新,如註冊資訊發生變更,應迅速修改。
          </li>
          <li>
            如註冊申請人符合以下任一情形,營運方可拒絕註冊,並不承擔任何披露理由的義務。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>註冊內容存在虛假事項</li>
              <li>過去因違反本條款等被註銷註冊的</li>
              <li>其他營運方判斷註冊不合適的情況</li>
            </ul>
          </li>
          <li>
            註冊使用者應負責適當管理自己的帳戶和密碼,不得讓第三方使用,也不得出借、轉讓、變更名義、買賣等。
          </li>
          <li>
            禁止一名使用者建立多個帳戶。
          </li>
          <li>
            使用 Google 帳戶或 LINE 帳戶進行社群登入(以下簡稱「社群登入」)時,使用者除遵守本條款外,還應遵守相應提供方(Google 或 LINE 株式會社)制定的服務條款和隱私政策。如因提供方一側的違規行為導致提供方帳戶被停止·限制,本服務一側的帳戶也可能被採取停止等措施。
          </li>
          <li>
            使用社群登入時,使用者同意本服務從相應提供方取得電子郵件、姓名等資訊,用於本服務的帳戶建立或與既有帳戶的關聯。取得資訊的詳細內容請參閱隱私政策第2條及第7條之2。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第4條 (投稿資料的處理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            投稿資料的著作權歸該投稿資料的投稿使用者所有。
          </li>
          <li>
            使用者向營運方表明並保證,關於投稿資料,自己擁有投稿或以其他方式傳送的合法權利,且投稿資料不侵犯第三方的智慧財產權、肖像權、隱私權及其他權利。
          </li>
          <li>
            使用者向營運方授予非獨占、無償、無地區限制的授權,允許以下使用投稿資料。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>本服務的提供·營運所必需範圍內的使用(顯示、傳送、儲存、複製等)</li>
              <li>本服務的廣告·宣傳·推廣目的的使用(社群媒體投稿、廣告素材等)</li>
              <li>本服務的提供所必需範圍內對第三方的子授權(CDN 傳送業者等)</li>
            </ul>
          </li>
          <li>
            使用者同意對營運方及營運方授權的第三方,不行使有關投稿資料的著作者人格權。
          </li>
          <li>
            即使使用者退會,對於退會前已用於推廣目的的投稿資料,營運方仍可繼續使用。
          </li>
          <li>
            其他使用者判斷投稿資料中包含的拍攝地點位置資訊不準確時,可指出認為正確的地點。投稿者應確認指正,作出接受或拒絕的判斷。投稿者接受指正時,拍攝地點的位置資訊將被更新。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第5條 (禁止事項)</h2>
        <p className="text-sm text-gray-700 mb-2">
          使用者在使用本服務時,不得進行以下行為。
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>違反法律法規或公序良俗的行為</li>
          <li>與犯罪行為相關的行為</li>
          <li>侵犯營運方、其他使用者或其他第三方的智慧財產權、肖像權、隱私權及其他權利的行為</li>
          <li>未經權利人許可投稿他人著作的行為</li>
          <li>未經本人同意投稿可識別人物的照片的行為</li>
          <li>助長私有地無斷進入的行為,或推薦進入危險場所的行為</li>
          <li>破壞或妨礙營運方伺服器或網路功能的行為</li>
          <li>對本服務進行逆向工程、爬取等行為</li>
          <li>未經營運方許可商業利用透過本服務取得的資訊的行為</li>
          <li>進行或試圖進行不當存取的行為</li>
          <li>蒐集或儲存有關其他使用者的個人資訊等的行為</li>
          <li>冒充其他使用者的行為</li>
          <li>一個人建立·營運多個帳戶的行為</li>
          <li>直接或間接向反社會勢力提供利益的行為</li>
          <li>
            投稿符合以下內容的行為
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>包含猥褻、露骨性表達的內容</li>
              <li>包含暴力、殘虐表達的內容</li>
              <li>有關兒童的性剝削的內容(CSAM/IHC)</li>
              <li>歧視性、屬於仇恨言論的內容</li>
              <li>其他令人不快的內容</li>
            </ul>
          </li>
          <li>可能妨礙本服務營運的行為</li>
          <li>其他營運方判斷不適當的行為</li>
        </ol>
        {/* Issue#105: 投稿者責任的強化 (拍攝地國法律遵守) */}
        <p className="text-sm text-gray-700 mt-3 font-semibold">投稿者的責任 (關於國際使用的附加事項)</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 mt-1">
          <li>
            使用者對所投稿的照片,負有遵守<span className="font-semibold">拍攝地國法律</span>(肖像權、隱私權、建築物拍攝禁止規制等)的責任。
          </li>
          <li>
            照片中第三方以可識別形式拍攝進入的情況下,使用者負有<span className="font-semibold">取得該人物的同意</span>,或加工成無法識別個人後再投稿的責任。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第6條 (使用費用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服務現階段免費提供。
          </li>
          <li>
            營運方將來可能引入付費功能。屆時將事先通知使用者。
          </li>
          <li>
            付費功能的使用費用、付款方式及其他條件,另行由營運方規定。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7條 (退會·帳戶刪除)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            註冊使用者可按營運方規定的程序隨時退會並刪除帳戶。
          </li>
          <li>
            退會後,使用者的個人資訊及投稿資料出於不當使用的調查·處理目的保管 90 天後,完全刪除。但根據第4條第5項規定已用於推廣目的的投稿資料除外。
          </li>
          <li>
            退會後的帳戶無法復原。
          </li>
          <li>
            退會後 90 天內,無法以退會時註冊的電子郵件重新註冊。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第8條 (註銷註冊)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方在使用者符合以下任一情形時,可不事先通知或催告而進行投稿資料的刪除、本服務的使用限制,或註銷作為使用者的註冊。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>違反本條款任一條項的</li>
          <li>判明註冊資訊有虛假事實的</li>
          <li>一定期間以上未登入本服務的</li>
          <li>其他營運方判斷本服務的使用不適當的</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第9條 (內容審核)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方為確認投稿資料是否符合本條款及營運方另行規定的內容政策,可能實施自動審查(包括 AI 技術的圖像分析)及人工審查。
          </li>
          <li>
            審查結果判定投稿資料違反內容政策或可能違反時,營運方可採取將該投稿資料非公開或刪除的措施。
          </li>
          <li>
            對違反內容政策的使用者,營運方可採取以下階段性措施。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>第1次違規: 警告</li>
              <li>第2次違規: 一定期間的投稿功能停止</li>
              <li>第3次以後違規: 帳戶的永久停止</li>
            </ul>
          </li>
          <li>
            檢測到有關兒童的性剝削的內容(CSAM/IHC)時,營運方將根據法律法規向相關機關舉報,並立即採取帳戶的永久停止及其他必要措施。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第10條 (本服務的停止·變更·終止)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方判斷有以下任一情形時,可不事先通知使用者而停止或中斷本服務的全部或部分提供。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>對本服務相關的電腦系統進行維護檢查或更新時</li>
              <li>因地震、雷擊、火災、停電或天災等不可抗力,本服務的提供變得困難時</li>
              <li>電腦或通訊線路等因事故停止時</li>
              <li>其他營運方判斷本服務的提供變得困難時</li>
            </ul>
          </li>
          <li>
            營運方可變更本服務的內容,或終止本服務的提供。終止本服務的提供時,營運方將事先通知使用者。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第11條 (免責事項)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方不明示或暗示保證本服務不存在事實上或法律上的瑕疵(包括安全性、可靠性、準確性、完整性、有效性、對特定目的的適合性、安全性等的缺陷,錯誤或漏洞,權利侵害等)。
          </li>
          <li>
            營運方對因本服務而對使用者產生的所有損害,除營運方故意或重大過失情況外,概不承擔責任。
          </li>
          <li>
            營運方對使用者與其他使用者或第三方之間產生的交易、聯絡或糾紛等概不承擔責任。
          </li>
          <li>
            營運方對投稿資料(包括拍攝地點資訊)的準確性、可靠性、安全性概不保證。基於投稿的拍攝地點資訊的行動,均由使用者自身負責進行。
          </li>
          <li>
            在使用本服務時,使用者應充分注意自身安全,負有遵守各地區法律法規的責任。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第12條 (條款的變更)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方判斷必要時,可不取得使用者同意而變更本條款。
          </li>
          <li>
            營運方進行本條款的重要變更時,將變更內容及變更的生效時期事先通知使用者。
          </li>
          <li>
            變更後的本條款自在本服務上發布之時起生效。
          </li>
          <li>
            使用者在本條款變更後繼續使用本服務時,該使用者視為同意變更後的條款。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第13條 (通知)</h2>
        <p className="text-sm text-gray-700">
          營運方向使用者的通知透過向註冊的電子郵件傳送郵件或在本服務上張貼及其他營運方判斷適當的方法進行。郵件通知在營運方傳送郵件之時視為已到達使用者。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第14條 (權利義務的轉讓禁止)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            使用者未經營運方書面事先同意,不得將本條款上的地位或基於本條款的權利或義務轉讓給第三方,或提供作為擔保。
          </li>
          <li>
            營運方將本服務相關業務轉讓他人時,可伴隨該業務轉讓將本條款上的地位、基於本條款的權利及義務以及使用者的註冊資訊及其他資訊轉讓給該業務轉讓的受讓人,使用者事先同意此事。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第15條 (可分性)</h2>
        <p className="text-sm text-gray-700">
          即使本條款的任一條項或其一部分被法律法規等判定為無效或不可執行,本條款的其餘規定及被判定為無效或不可執行的規定的剩餘部分仍繼續完全有效。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第16條 (準據法·管轄法院)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本條款的解釋以日本法律為準據法。
          </li>
          <li>
            就本服務發生糾紛時,以東京地方法院為第一審的專屬合意管轄法院。
          </li>
          {/* Issue#105: 國際使用的提示 */}
          <li>
            本服務由設立於日本的營運方提供,但接受來自全球的存取。使用者在使用本服務時,應自行負責確認是否可以根據<span className="font-semibold">本國的法律</span>使用本服務。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第17條 (外部服務的使用)</h2>
        <p className="text-sm text-gray-700 mb-2">
          本服務使用以下外部服務。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>地圖顯示和地點搜尋使用 <a href="https://www.mapbox.com/legal/tos" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Mapbox</a>。地圖資料基於 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OpenStreetMap</a> 提供的資料。</li>
          <li>服務改進的存取分析使用 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Analytics 4</a>。</li>
          <li>圖像儲存·傳送使用 Amazon Web Services(AWS)。</li>
          <li>錯誤監控使用 <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Sentry</a>。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第18條 (諮詢)</h2>
        <p className="text-sm text-gray-700">
          關於本條款的諮詢,請聯絡以下窗口。
        </p>
        <p className="text-sm text-gray-700 mt-2">
          營運方名稱: Photlas 營運方<br />
          電子郵件: support@photlas.jp
        </p>
      </section>

      <section className="pt-6 border-t">
        <p className="text-sm text-gray-500">
          制定日: 2026年2月16日<br />
          最近修訂日: 2026年5月1日 (更新為國際版)
        </p>
      </section>
    </div>
  )
}
