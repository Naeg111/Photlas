/**
 * TermsContentZhCN コンポーネント
 * Issue#101: 服务条款正文 (简体中文)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 */
export function TermsContentZhCN() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          本服务条款(以下简称「本条款」)旨在规定 Photlas 运营方(以下简称「运营方」)提供的服务「Photlas」(以下简称「本服务」)的提供条件以及与本服务的使用相关的运营方与用户之间的权利义务关系。在使用本服务前,请仔细阅读本条款。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第1条 (适用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本条款旨在规定本服务的提供条件以及与本服务的使用相关的运营方与用户之间的权利义务关系,并适用于用户与运营方之间所有与本服务使用相关的关系。
          </li>
          <li>
            用户使用本服务即视为同意本条款的所有条项。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第2条 (定义)</h2>
        <p className="text-sm text-gray-700 mb-2">
          本条款中使用的以下用语分别具有以下规定的含义。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>「本服务」是指运营方提供的名为「Photlas」(photlas.jp)的网络服务。</li>
          <li>「用户」是指同意本条款后使用本服务的所有人。</li>
          <li>「注册用户」是指在本服务上完成账户注册的用户。</li>
          <li>
            「投稿数据」是指用户使用本服务投稿或以其他方式发送的内容,包括但不限于以下内容。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>照片文件</li>
              <li>拍摄元数据(位置信息、拍摄日期时间、相机信息、镜头信息、拍摄设置值等)</li>
              <li>标题、设施名称、分类选择、天气信息</li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第3条 (用户注册)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            {/* Issue#105: 13岁以上的使用限制 (与隐私政策第12条整合) */}
            本服务面向<span className="font-semibold">年满 13周岁</span>的用户提供。未满 13周岁的人不能进行用户注册及本服务的使用。
          </li>
          <li>
            希望使用本服务部分功能的人,需同意遵守本条款,按运营方规定的方法申请用户注册。注册需要输入电子邮箱、显示名称及密码。
          </li>
          <li>
            用户应保持注册信息准确且最新,如注册信息发生变更,应迅速修改。
          </li>
          <li>
            如注册申请人符合以下任一情形,运营方可拒绝注册,并不承担任何披露理由的义务。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>注册内容存在虚假事项</li>
              <li>过去因违反本条款等被注销注册的</li>
              <li>其他运营方判断注册不合适的情况</li>
            </ul>
          </li>
          <li>
            注册用户应负责适当管理自己的账户和密码,不得让第三方使用,也不得出借、转让、变更名义、买卖等。
          </li>
          <li>
            禁止一名用户创建多个账户。
          </li>
          <li>
            使用 Google 账户或 LINE 账户进行社交登录(以下简称「社交登录」)时,用户除遵守本条款外,还应遵守相应提供方(Google 或 LINE 株式会社)制定的服务条款和隐私政策。如因提供方一侧的违规行为导致提供方账户被停止·限制,本服务一侧的账户也可能被采取停止等措施。
          </li>
          <li>
            使用社交登录时,用户同意本服务从相应提供方获取电子邮箱、姓名等信息,用于本服务的账户创建或与现有账户的关联。获取信息的详细内容请参阅隐私政策第2条及第7条之2。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第4条 (投稿数据的处理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            投稿数据的著作权归该投稿数据的投稿用户所有。
          </li>
          <li>
            用户向运营方表明并保证,关于投稿数据,自己拥有投稿或以其他方式发送的合法权利,且投稿数据不侵犯第三方的知识产权、肖像权、隐私权及其他权利。
          </li>
          <li>
            用户向运营方授予非独占、无偿、无地区限制的许可,允许以下使用投稿数据。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>本服务的提供·运营所必需范围内的使用(显示、分发、保存、复制等)</li>
              <li>本服务的广告·宣传·推广目的的使用(社交媒体投稿、广告素材等)</li>
              <li>本服务的提供所必需范围内对第三方的子许可(CDN 分发业者等)</li>
            </ul>
          </li>
          <li>
            用户同意对运营方及运营方许可的第三方,不行使有关投稿数据的著作者人格权。
          </li>
          <li>
            即使用户退会,对于退会前已用于推广目的的投稿数据,运营方仍可继续使用。
          </li>
          <li>
            其他用户判断投稿数据中包含的拍摄地点位置信息不准确时,可指出认为正确的地点。投稿者应确认指正,作出接受或拒绝的判断。投稿者接受指正时,拍摄地点的位置信息将被更新。
          </li>
          {/* Issue#119: 运营方对 AI 分类信息的修改 */}
          <li>
            运营方可能会为提高搜索准确性而修改分配给帖子的类别和天气等分类信息。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第5条 (禁止事项)</h2>
        <p className="text-sm text-gray-700 mb-2">
          用户在使用本服务时,不得进行以下行为。
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>违反法律法规或公序良俗的行为</li>
          <li>与犯罪行为相关的行为</li>
          <li>侵犯运营方、其他用户或其他第三方的知识产权、肖像权、隐私权及其他权利的行为</li>
          <li>未经权利人许可投稿他人著作的行为</li>
          <li>未经本人同意投稿可识别人物的照片的行为</li>
          <li>助长私有地无断进入的行为,或推荐进入危险场所的行为</li>
          <li>破坏或妨碍运营方服务器或网络功能的行为</li>
          <li>对本服务进行逆向工程、爬取等行为</li>
          <li>未经运营方许可商业利用通过本服务获得的信息的行为</li>
          <li>进行或试图进行不正访问的行为</li>
          <li>收集或储存有关其他用户的个人信息等的行为</li>
          <li>冒充其他用户的行为</li>
          <li>一个人创建·运用多个账户的行为</li>
          <li>直接或间接向反社会势力提供利益的行为</li>
          <li>
            投稿符合以下内容的行为
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>包含猥亵、露骨性表达的内容</li>
              <li>包含暴力、残虐表达的内容</li>
              <li>有关儿童的性剥削的内容(CSAM/IHC)</li>
              <li>歧视性、属于仇恨言论的内容</li>
              <li>其他令人不快的内容</li>
            </ul>
          </li>
          <li>可能妨碍本服务运营的行为</li>
          <li>其他运营方判断不适当的行为</li>
        </ol>
        {/* Issue#105: 投稿者责任的强化 (拍摄地国法律遵守) */}
        <p className="text-sm text-gray-700 mt-3 font-semibold">投稿者的责任 (关于国际使用的附加事项)</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 mt-1">
          <li>
            用户对所投稿的照片,负有遵守<span className="font-semibold">拍摄地国法律</span>(肖像权、隐私权、建筑物拍摄禁止规制等)的责任。
          </li>
          <li>
            照片中第三方以可识别形式拍摄进入的情况下,用户负有<span className="font-semibold">取得该人物的同意</span>,或加工成无法识别个人后再投稿的责任。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第6条 (使用费用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服务现阶段免费提供。
          </li>
          <li>
            运营方将来可能引入付费功能。届时将事先通知用户。
          </li>
          <li>
            付费功能的使用费用、付款方式及其他条件,另行由运营方规定。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7条 (退会·账户删除)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            注册用户可按运营方规定的程序随时退会并删除账户。
          </li>
          <li>
            退会后,用户的个人信息及投稿数据出于不正使用的调查·处理目的保管 90 天后,完全删除。但根据第4条第5项规定已用于推广目的的投稿数据除外。
          </li>
          <li>
            退会后的账户无法恢复。
          </li>
          <li>
            退会后 90 天内,无法以退会时注册的电子邮箱重新注册。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第8条 (注销注册)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方在用户符合以下任一情形时,可不事先通知或催告而进行投稿数据的删除、本服务的使用限制,或注销作为用户的注册。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>违反本条款任一条项的</li>
          <li>判明注册信息有虚假事实的</li>
          <li>一定期间以上未登录本服务的</li>
          <li>其他运营方判断本服务的使用不适当的</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第9条 (内容审核)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方为确认投稿数据是否符合本条款及运营方另行规定的内容政策,可能实施自动审查(包括 AI 技术的图像分析)及人工审查。
          </li>
          <li>
            审查结果判定投稿数据违反内容政策或可能违反时,运营方可采取将该投稿数据非公开或删除的措施。
          </li>
          <li>
            对违反内容政策的用户,运营方可采取以下阶段性措施。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>第1次违规: 警告</li>
              <li>第2次违规: 一定期间的投稿功能停止</li>
              <li>第3次以后违规: 账户的永久停止</li>
            </ul>
          </li>
          <li>
            检测到有关儿童的性剥削的内容(CSAM/IHC)时,运营方将根据法律法规向相关机关举报,并立即采取账户的永久停止及其他必要措施。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第10条 (本服务的停止·变更·终止)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方判断有以下任一情形时,可不事先通知用户而停止或中断本服务的全部或部分提供。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>对本服务相关的计算机系统进行维护检查或更新时</li>
              <li>因地震、雷击、火灾、停电或天灾等不可抗力,本服务的提供变得困难时</li>
              <li>计算机或通信线路等因事故停止时</li>
              <li>其他运营方判断本服务的提供变得困难时</li>
            </ul>
          </li>
          <li>
            运营方可变更本服务的内容,或终止本服务的提供。终止本服务的提供时,运营方将事先通知用户。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第11条 (免责事项)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方不明示或暗示保证本服务不存在事实上或法律上的瑕疵(包括安全性、可靠性、准确性、完整性、有效性、对特定目的的适合性、安全性等的缺陷,错误或漏洞,权利侵害等)。
          </li>
          <li>
            运营方对因本服务而对用户产生的所有损害,除运营方故意或重大过失情况外,概不承担责任。
          </li>
          <li>
            运营方对用户与其他用户或第三方之间产生的交易、联络或纠纷等概不承担责任。
          </li>
          <li>
            运营方对投稿数据(包括拍摄地点信息)的准确性、可靠性、安全性概不保证。基于投稿的拍摄地点信息的行动,均由用户自身负责进行。
          </li>
          <li>
            在使用本服务时,用户应充分注意自身安全,负有遵守各地区法律法规的责任。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第12条 (条款的变更)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方判断必要时,可不取得用户同意而变更本条款。
          </li>
          <li>
            运营方进行本条款的重要变更时,将变更内容及变更的生效时期事先通知用户。
          </li>
          <li>
            变更后的本条款自在本服务上发布之时起生效。
          </li>
          <li>
            用户在本条款变更后继续使用本服务时,该用户视为同意变更后的条款。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第13条 (通知)</h2>
        <p className="text-sm text-gray-700">
          运营方向用户的通知通过向注册的电子邮箱发送邮件或在本服务上张贴及其他运营方判断适当的方法进行。邮件通知在运营方发送邮件之时视为已到达用户。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第14条 (权利义务的转让禁止)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            用户未经运营方书面事先同意,不得将本条款上的地位或基于本条款的权利或义务转让给第三方,或提供作为担保。
          </li>
          <li>
            运营方将本服务相关业务转让他人时,可伴随该业务转让将本条款上的地位、基于本条款的权利及义务以及用户的注册信息及其他信息转让给该业务转让的受让人,用户事先同意此事。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第15条 (可分性)</h2>
        <p className="text-sm text-gray-700">
          即使本条款的任一条项或其一部分被法律法规等判定为无效或不可执行,本条款的其余规定及被判定为无效或不可执行的规定的剩余部分仍继续完全有效。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第16条 (准据法·管辖法院)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本条款的解释以日本法律为准据法。
          </li>
          <li>
            就本服务发生纠纷时,以东京地方法院为第一审的专属合意管辖法院。
          </li>
          {/* Issue#105: 国际使用的提示 */}
          <li>
            本服务由设立于日本的运营方提供,但接受来自全球的访问。用户在使用本服务时,应自行负责确认是否可以根据<span className="font-semibold">本国的法律</span>使用本服务。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第17条 (外部服务的使用)</h2>
        <p className="text-sm text-gray-700 mb-2">
          本服务使用以下外部服务。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>地图显示和地点搜索使用 <a href="https://www.mapbox.com/legal/tos" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Mapbox</a>。地图数据基于 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OpenStreetMap</a> 提供的数据。</li>
          <li>服务改进的访问分析使用 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Analytics 4</a>。</li>
          <li>图像保存·分发使用 Amazon Web Services(AWS)。</li>
          <li>错误监控使用 <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Sentry</a>。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第18条 (咨询)</h2>
        <p className="text-sm text-gray-700">
          关于本条款的咨询,请联系以下窗口。
        </p>
        <p className="text-sm text-gray-700 mt-2">
          运营方名称: Photlas 运营方<br />
          电子邮箱: support@photlas.jp
        </p>
      </section>

      <section className="pt-6 border-t">
        <p className="text-sm text-gray-500">
          制定日: 2026年2月16日<br />
          最近修订日: 2026年5月1日 (更新为国际版)
        </p>
      </section>
    </div>
  )
}
