/**
 * PrivacyContentZhTW コンポーネント
 * Issue#101: 隱私政策本文 (繁體中文)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 *
 * 注: 簡体字版から繁体字に変換し、台湾向けの語彙
 * (資訊/伺服器/網際網路 等) に調整した版。
 */
export function PrivacyContentZhTW() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          Photlas 營運方(以下簡稱「營運方」)就本服務「Photlas」(以下簡稱「本服務」)中使用者個人資訊的處理,訂定如下隱私政策(以下簡稱「本政策」)。營運方遵守日本《個人資訊保護法》及其他相關法律法規,妥善處理使用者的個人資訊。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第1條 (基本方針)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方將個人資訊保護視為重要責任,遵守日本《個人資訊保護法》及其他相關法律法規與指引,並按照本政策妥善處理個人資訊。本政策規定了本服務(photlas.jp)中個人資訊的處理事項。
        </p>
        <p className="text-sm text-gray-700">
          本政策中所稱「個人資訊」是指日本《個人資訊保護法》所稱「個人資訊」,即關於在世個人的資訊,透過該資訊中包含的電子郵件、顯示名稱等記述等可以識別特定個人的資訊。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第2條 (蒐集的資訊)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方在提供本服務時蒐集以下資訊。
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(1) 帳戶資訊</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>電子郵件</li>
          <li>顯示名稱</li>
          <li>密碼(加密儲存)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(2) 個人資料資訊</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>大頭貼圖片</li>
          <li>社群帳戶連結(最多3條)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(3) 投稿資料</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>照片檔案</li>
          <li>標題、設施名稱、分類、天氣資訊</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(4) 照片中繼資料 (EXIF 資訊)</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>拍攝日期時間</li>
          <li>GPS 座標(經度/緯度)</li>
          <li>相機機身名稱</li>
          <li>鏡頭名稱</li>
          <li>焦距、光圈值、快門速度、ISO 感光度</li>
          <li>影像尺寸</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(5) 位置資訊</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>拍攝地點的 GPS 座標(從照片 EXIF 資訊自動取得,或由使用者手動輸入)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(6) 使用資料</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>收藏註冊資訊</li>
          <li>檢舉資訊(檢舉理由、檢舉對象)</li>
          <li>內容審核資訊(審核結果、違規歷史、制裁資訊)</li>
          <li>位置資訊指正資料(指正地點的座標、指正狀態)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(7) 技術資訊</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>
            WAF 日誌(AWS WAF 蒐集的 IP 位址、請求 URL、User-Agent、存取時間。
            使用目的為速率限制控制及不當存取的偵測與調查。
            保留期限最長 90 天,期滿後自動刪除)
          </li>
          <li>錯誤資訊(透過外部服務「Sentry」蒐集。僅傳送全部錯誤的一部分)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(8) 社群登入認證資訊</h3>
        <p className="text-sm text-gray-700 mb-1">
          當使用者使用 Google 或 LINE 帳戶登入本服務時,從各提供方取得以下資訊。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Google: 電子郵件、Google 使用者 ID(<code>sub</code> claim)</li>
          <li>LINE: 電子郵件、顯示名稱、LINE 使用者 ID</li>
        </ul>
        <p className="text-sm text-gray-700 mt-1">
          此外,Google 或 LINE 一方管理的認證資訊(密碼等)本服務一概不予保存。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第3條 (資訊蒐集方式)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方透過以下方式蒐集資訊。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>使用者直接輸入的資訊(帳戶註冊時、個人資料編輯時、照片投稿時)</li>
          <li>從照片檔案自動擷取的資訊(EXIF 資訊中包含的拍攝日期時間、GPS 座標、相機資訊等)</li>
          <li>使用服務時自動取得的資訊(IP 位址、錯誤資訊)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第4條 (資訊使用目的)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方蒐集和使用個人資訊的目的如下。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>本服務的提供、營運、改進</li>
          <li>使用者的本人確認、認證</li>
          <li>提供在地圖上顯示照片拍攝地點的功能</li>
          <li>顯示照片的拍攝資訊(相機、鏡頭、設定值等)</li>
          <li>就新功能、更新資訊、維護等向使用者發出通知</li>
          <li>密碼重設的處理</li>
          <li>不當使用的偵測和防止(速率限制、不當存取防止)</li>
          <li>對違反使用條款行為的處理</li>
          <li>本服務的廣告、宣傳、推廣(投稿資料的利用)</li>
          <li>使用者諮詢的處理</li>
          {/* Issue#106: 透過 IP 位址判定國家 */}
          <li>基於 IP 位址判定使用者所在國家(用於最佳化地圖的初始顯示位置。IP 位址不會儲存在伺服器上,僅用於轉換為國家代碼)</li>
          <li>附屬於上述使用目的的目的</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第5條 (資訊保存與安全)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方透過以下方式安全管理蒐集的資訊。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>密碼透過 BCrypt 加密(雜湊化)後儲存,包括營運方在內任何人都無法查看原始密碼。</li>
          <li>照片檔案及大頭貼圖片儲存在 Amazon Web Services(AWS)的雲端儲存中。</li>
          <li>認證使用 JSON Web Token(JWT),權杖儲存在使用者瀏覽器中。</li>
          <li>所有通訊均透過 HTTPS 加密進行。</li>
          <li>為防止不當存取,實施了存取頻率限制(速率限制)。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第6條 (第三方提供與外部服務的使用)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: Do Not Sell 宣告 */}
          營運方不會向第三方出售使用者的個人資訊。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            除以下情形外,營運方不會未經使用者事先同意向第三方提供個人資訊。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>基於法律法規的情況</li>
              <li>為保護人的生命、身體或財產所必需,且難以取得本人同意時</li>
              <li>為提高公共衛生或推進兒童的健全成長所特別必要,且難以取得本人同意時</li>
              <li>需要協助國家機關或地方公共團體或其受託方履行法定事務,且取得本人同意將妨礙該事務履行時</li>
            </ul>
          </li>
          <li>
            營運方將本服務相關業務轉讓他人時,可能伴隨該業務轉讓向受讓方提供個人資訊。
          </li>
          <li>
            營運方在提供本服務時使用以下外部服務,使用者的部分資訊可能被傳送至這些服務。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <span className="font-semibold">Amazon Web Services(AWS S3、CloudFront、SES、Rekognition)</span>: 用於圖片檔案的儲存與傳送、郵件傳送以及內容自動審核。資料在 AWS 東京區域(ap-northeast-1)處理。
              </li>
              <li>
                <span className="font-semibold">Mapbox</span>: 用於地圖顯示、拍攝地點位置資訊顯示和地點搜尋。Mapbox 的隱私政策請參閱{' '}
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此處</a>。
              </li>
              <li>
                <span className="font-semibold">Google Analytics 4</span>: 用於服務改進的存取分析。蒐集頁面瀏覽數、使用情況等匿名化資料。Google 的隱私政策請參閱{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此處</a>。
              </li>
              <li>
                <span className="font-semibold">Sentry</span>: 用於應用程式的錯誤監控。錯誤發生時傳送技術性錯誤資訊(僅傳送全部錯誤的一部分)。Sentry 的隱私政策請參閱{' '}
                <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此處</a>。
              </li>
              {/* Issue#106: MaxMind GeoLite2 (透過 IP 位址判定國家) */}
              <li>
                <span className="font-semibold">MaxMind GeoLite2</span>: 用於透過 IP 位址判定使用者所在國家,以最佳化地圖的初始顯示位置。判定處理在伺服器上執行,IP 位址僅用於轉換為國家代碼,不會被儲存。本服務使用 GeoLite2 資料(Includes GeoLite2 data created by MaxMind, available from{' '}
                <a href="https://www.maxmind.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">https://www.maxmind.com</a>
                )。
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7條 (EXIF 資訊的處理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方從使用者投稿的照片檔案中包含的 EXIF 資訊自動擷取拍攝日期時間、GPS 座標、相機資訊、鏡頭資訊、拍攝設定值等。
          </li>
          <li>
            擷取的拍攝資訊(相機名稱、鏡頭名稱、焦距、光圈值、快門速度、ISO 感光度等)在本服務的 UI 上向其他使用者顯示。
          </li>
          <li>
            位置資訊(GPS 座標)作為拍攝地點顯示在地圖上。使用者在投稿照片時,理解並同意位置資訊將在本服務上公開後再進行投稿。
          </li>
          <li>
            本服務在投稿時自動從照片檔案中刪除 EXIF 資訊後保存到伺服器。但瀏覽器顯示的圖像在技術上可能被保存。營運方不保證圖像資料的完整保護。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7條之2 (社群登入相關資訊的取得與處理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服務提供 Google 和 LINE 帳戶登入(以下簡稱「社群登入」)。使用社群登入時,使用者需在各提供方的認證畫面同意將電子郵件等資訊提供給本服務。
          </li>
          <li>
            取得的資訊僅用於本服務的帳戶建立及與既有帳戶的關聯目的。不用於 Google 廣告或 LINE 廣告等提供方的廣告目的。
          </li>
          <li>
            社群登入附帶的提供方發行的存取權杖,僅在退會時為撤銷提供方一側的存取權限(revoke)的目的而短期保存,使用 AES-256-GCM 加密後保存。revoke 完成後立即刪除。
          </li>
          <li>
            使用者退會時,社群登入取得的資訊及本服務保存的 OAuth 關聯資訊將按照第11條規定的帳戶刪除時資料處理進行刪除。作為退會處理的一環,傳送撤銷提供方一側存取權限的 revoke 請求。
          </li>
          <li>
            使用社群登入時,各提供方的隱私政策也一併適用。詳細請參閱 Google 及 LINE 的官方隱私政策。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第8條 (內容自動審核)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方為確保內容政策的遵守,使用 AI 技術(Amazon Rekognition Content Moderation)對使用者投稿的照片實施自動圖像分析。
          </li>
          <li>
            自動審核分析投稿的圖像是否屬於不當內容(性表達、暴力表達、兒童的性剝削等)。圖像資料在 AWS 東京區域處理,僅保存分析結果。
          </li>
          <li>
            被自動審核判定為不當的投稿將暫時處於非公開(隔離)狀態,由營運方進行人工確認。
          </li>
          <li>
            自動審核的結果及違規歷史出於內容審核及帳戶管理的目的進行保存。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第9條 (Cookie 等的使用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服務不使用認證目的的 Cookie。認證使用 JSON Web Token(JWT),透過以下方式儲存在瀏覽器中。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>登入時選擇「記住登入」時: localStorage(關閉瀏覽器後仍保留,有效期 24 小時)</li>
              <li>未選擇時: sessionStorage(關閉瀏覽器後刪除)</li>
            </ul>
          </li>
          <li>
            僅在社群登入流程中,為管理 OAuth 2.0 的 state 參數及 CSRF 對策,伺服器發行必需 Cookie(<code>JSESSIONID</code>)。該 Cookie 以 SameSite=Lax、Secure 屬性發行,在社群登入流程完成後或工作階段過期時失效。
          </li>
          <li>
            本服務使用 Google Analytics 4,Google 可能為蒐集存取資訊而使用 Cookie。蒐集的資料已匿名化,無法識別個人。首次造訪時顯示 Cookie 同意橫幅,使用者可選擇同意或拒絕。同意時進行使用 Cookie 的全面測量,拒絕時僅進行不使用 Cookie 的匿名基本測量。
          </li>
          <li>
            其他外部服務(Mapbox、Sentry 等)可能獨自使用 Cookie。這些 Cookie 的處理請確認各服務的隱私政策。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第10條 (個人資訊的公開、更正、刪除)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            使用者對自己的個人資訊擁有以下權利。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>請求公開個人資訊的權利</li>
              <li>請求更正、追加或刪除個人資訊的權利</li>
              <li>請求停止使用個人資訊的權利</li>
            </ul>
          </li>
          <li>
            上述請求透過傳送郵件至 support@photlas.jp 受理。營運方將在進行本人確認後,在合理期限內進行處理。
          </li>
          <li>
            個人資料資訊的一部分(顯示名稱、大頭貼圖片、社群帳戶連結)使用者可以自行在本服務上變更或刪除。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第11條 (帳戶刪除時的資料處理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            使用者退會時,以下資料出於不當使用的調查和處理目的保存 90 天後,連同備份完全刪除。但根據使用條款已用於推廣目的而公開的投稿資料除外。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>帳戶資訊(電子郵件、顯示名稱等)</li>
              <li>個人資料資訊(大頭貼圖片、社群帳戶連結)</li>
              <li>投稿資料(照片檔案、中繼資料等)</li>
              <li>收藏、檢舉資訊</li>
              <li>社群登入關聯資訊(OAuth 提供方關聯記錄、加密的存取權杖)</li>
            </ul>
          </li>
          <li>
            關於社群登入關聯資訊,作為退會處理的一環,非同步嘗試撤銷(revoke)相應提供方(Google / LINE)的存取權杖。藉此,本服務取得的對 Google / LINE 帳戶的存取權限將被迅速撤銷。
          </li>
          <li>
            刪除後的資料無法復原。
          </li>
          <li>
            {/* Issue#105: 審核刪除照片的 180 日保存公開 */}
            因內容審核被刪除的照片及其中繼資料,出於複審、申訴處理目的保存 180 天後完全刪除。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第12條 (未成年人的使用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          {/* Issue#105: 13歲以上的使用限制 (符合 COPPA) */}
          <li>
            本服務面向<span className="font-semibold">年滿 13歲</span>的使用者提供。未滿 13歲的人不能使用本服務。如發現未滿 13歲的人誤註冊,營運方將採取刪除帳戶及相關資料的措施。
          </li>
          <li>
            年滿 13歲未滿 18 歲的未成年人使用本服務時,需取得法定代理人(監護人)的同意後方可使用。未成年人使用本服務時,視為已取得法定代理人的同意。
          </li>
          <li>
            關於未滿 13歲子女註冊的監護人諮詢,請聯絡第18條的諮詢窗口。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第13條 (使用目的的變更)</h2>
        <p className="text-sm text-gray-700">
          僅在合理認定使用目的與變更前具有關聯性的情況下,營運方將變更個人資訊的使用目的。變更使用目的時,將就變更後的目的向使用者通知或在本服務上公布。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第14條 (隱私政策的變更)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            營運方可能根據法律修訂或服務變更而變更本政策。
          </li>
          <li>
            本政策進行重大變更時,事先向使用者通知。
          </li>
          <li>
            變更後的隱私政策自在本服務上發布之時起生效。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第15條 (個人資料處理的法律依據)</h2>
        <p className="text-sm text-gray-700 mb-2">
          營運方基於以下法律依據處理個人資料。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">同意</span>(GDPR 第6條1款(a)): Google Analytics 4 進行的存取分析。使用者可透過 Cookie 同意橫幅選擇同意或拒絕。</li>
          <li><span className="font-semibold">合約履行</span>(GDPR 第6條1款(b)): 帳戶管理、服務提供、地圖功能(Mapbox)的提供。</li>
          <li><span className="font-semibold">正當利益</span>(GDPR 第6條1款(f)): 錯誤監控(Sentry)、不當使用的偵測和防止、服務安全性的確保、基於 IP 位址判定國家以最佳化初始顯示位置(提升使用者便利性)。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第16條 (基於歐盟一般資料保護條例(GDPR)的權利)</h2>
        <p className="text-sm text-gray-700 mb-2">
          居住在歐洲經濟區(EEA)的使用者根據 GDPR 享有以下權利。希望行使這些權利時,請聯絡 support@photlas.jp。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">存取權</span>: 請求自己個人資料副本的權利</li>
          <li><span className="font-semibold">更正權</span>: 請求更正不準確個人資料的權利</li>
          <li><span className="font-semibold">刪除權(被遺忘權)</span>: 請求刪除個人資料的權利</li>
          <li><span className="font-semibold">處理限制權</span>: 請求限制個人資料處理的權利</li>
          <li><span className="font-semibold">資料可攜權</span>: 以結構化、機器可讀格式接收個人資料的權利。行使本權利時請聯絡第18條的諮詢窗口。營運方將匯出您的資料並提供給您(基於請求的營運)。</li>
          <li><span className="font-semibold">異議權</span>: 對基於正當利益的處理提出異議的權利</li>
          <li><span className="font-semibold">同意撤回權</span>: 對基於同意的處理隨時撤回同意的權利(從瀏覽器設定刪除本網站的網站資料後,Cookie 同意橫幅會再次顯示,可撤回同意)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第17條 (國際資料傳輸)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: 國際使用者的綜合性提示 */}
          本服務由設立於日本的營運方提供,可在全球存取。即使從日本境外存取,使用者的個人資料也會傳輸至日本伺服器後處理。
        </p>
        <p className="text-sm text-gray-700 mb-2">
          使用者的個人資料可能在服務提供所必需的範圍內傳輸至以下地區。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">日本(AWS 東京區域)</span>: 圖像檔案儲存與傳送、資料庫、內容審核</li>
          <li><span className="font-semibold">美國</span>: Google Analytics 4 進行的存取分析資料、Sentry 進行的錯誤監控資料</li>
        </ul>
        <p className="text-sm text-gray-700 mt-2">
          這些服務提供方根據各自的隱私政策及資料處理協議採取了適當的資料保護措施。
        </p>
        <p className="text-sm text-gray-700 mt-2">
          {/* Issue#105: 尊重使用者居住國法律授予的權利 */}
          根據使用者居住國家的法律,如享有本政策未記載的額外權利,營運方將尊重這些權利,並按照適用法律法規的規定進行處理。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第18條 (諮詢窗口)</h2>
        <p className="text-sm text-gray-700">
          關於本政策的諮詢,請聯絡以下窗口。
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
