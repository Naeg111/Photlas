/**
 * PrivacyContentZhCN コンポーネント
 * Issue#101: 隐私政策正文 (简体中文)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 */
export function PrivacyContentZhCN() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          Photlas 运营方(以下简称「运营方」)就本服务「Photlas」(以下简称「本服务」)中用户个人信息的处理,制定如下隐私政策(以下简称「本政策」)。运营方遵守日本《个人信息保护法》及其他相关法律法规,妥善处理用户的个人信息。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第1条 (基本方针)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方将个人信息保护视为重要责任,遵守日本《个人信息保护法》及其他相关法律法规和指引,并按照本政策妥善处理个人信息。本政策规定了本服务(photlas.jp)中个人信息的处理事项。
        </p>
        <p className="text-sm text-gray-700">
          本政策中所称「个人信息」是指日本《个人信息保护法》所称「个人信息」,即关于在世个人的信息,通过该信息中包含的电子邮箱、显示名称等记述等可以识别特定个人的信息。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第2条 (收集的信息)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方在提供本服务时收集以下信息。
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(1) 账户信息</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>电子邮箱</li>
          <li>显示名称</li>
          <li>密码(加密保存)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(2) 个人资料信息</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>头像图片</li>
          <li>社交账户链接(最多3条)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(3) 投稿数据</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>照片文件</li>
          <li>标题、设施名称、分类、天气信息</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(4) 照片元数据 (EXIF 信息)</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>拍摄日期时间</li>
          <li>GPS 坐标(经度/纬度)</li>
          <li>相机机身名称</li>
          <li>镜头名称</li>
          <li>焦距、光圈值、快门速度、ISO 感光度</li>
          <li>图像尺寸</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(5) 位置信息</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>拍摄地点的 GPS 坐标(从照片 EXIF 信息自动获取,或由用户手动输入)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(6) 使用数据</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>收藏注册信息</li>
          <li>举报信息(举报理由、举报对象)</li>
          <li>内容审核信息(审核结果、违规历史、制裁信息)</li>
          <li>位置信息指正数据(指正地点的坐标、指正状态)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(7) 技术信息</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>
            WAF 日志(AWS WAF 收集的 IP 地址、请求 URL、User-Agent、访问时间。
            使用目的为速率限制控制及不正访问的检测和调查。
            保留期限最长 90 天,期满后自动删除)
          </li>
          <li>错误信息(通过外部服务「Sentry」收集。仅发送全部错误中的一部分)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(8) 社交登录认证信息</h3>
        <p className="text-sm text-gray-700 mb-1">
          当用户使用 Google 或 LINE 账户登录本服务时,从各提供方获取以下信息。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Google: 电子邮箱、Google 用户 ID(<code>sub</code> claim)</li>
          <li>LINE: 电子邮箱、显示名称、LINE 用户 ID</li>
        </ul>
        <p className="text-sm text-gray-700 mt-1">
          此外,Google 或 LINE 一方管理的认证信息(密码等)本服务一概不予保存。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第3条 (信息收集方式)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方通过以下方式收集信息。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>用户直接输入的信息(账户注册时、个人资料编辑时、照片投稿时)</li>
          <li>从照片文件自动提取的信息(EXIF 信息中包含的拍摄日期时间、GPS 坐标、相机信息等)</li>
          <li>使用服务时自动获取的信息(IP 地址、错误信息)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第4条 (信息使用目的)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方收集和使用个人信息的目的如下。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>本服务的提供、运营、改进</li>
          <li>用户的本人确认、认证</li>
          <li>提供在地图上显示照片拍摄地点的功能</li>
          <li>显示照片的拍摄信息(相机、镜头、设置值等)</li>
          <li>就新功能、更新信息、维护等向用户发出通知</li>
          <li>密码重置的处理</li>
          <li>不正使用的检测和防止(速率限制、不正访问防止)</li>
          <li>对违反使用条款行为的处理</li>
          <li>本服务的广告、宣传、推广(投稿数据的利用)</li>
          <li>用户咨询的处理</li>
          {/* Issue#106: 通过 IP 地址判定国家 */}
          <li>基于 IP 地址判定用户所在国家(用于优化地图的初始显示位置。IP 地址不会保存在服务器上,仅用于转换为国家代码)</li>
          <li>附属于上述使用目的的目的</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第5条 (信息保存与安全)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方通过以下方式安全管理收集的信息。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>密码通过 BCrypt 加密(哈希化)后保存,包括运营方在内任何人都无法查看原始密码。</li>
          <li>照片文件及头像图片保存在 Amazon Web Services(AWS)的云存储中。</li>
          <li>认证使用 JSON Web Token(JWT),令牌保存在用户浏览器中。</li>
          <li>所有通信均通过 HTTPS 加密进行。</li>
          <li>为防止不正访问,实施了访问频率限制(速率限制)。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第6条 (第三方提供与外部服务的使用)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: Do Not Sell 声明 */}
          运营方不会向第三方出售用户的个人信息。
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            除以下情形外,运营方不会未经用户事先同意向第三方提供个人信息。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>基于法律法规的情况</li>
              <li>为保护人的生命、身体或财产所必需,且难以获得本人同意时</li>
              <li>为提高公共卫生或推进儿童的健全成长所特别必要,且难以获得本人同意时</li>
              <li>需要协助国家机关或地方公共团体或其受托方履行法定事务,且获得本人同意将妨碍该事务履行时</li>
            </ul>
          </li>
          <li>
            运营方将本服务相关业务转让他人时,可能伴随该业务转让向受让方提供个人信息。
          </li>
          <li>
            运营方在提供本服务时使用以下外部服务,用户的部分信息可能被发送至这些服务。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <span className="font-semibold">Amazon Web Services(AWS S3、CloudFront、SES、Rekognition)</span>: 用于图像文件的保存与分发、邮件发送以及内容自动审核。数据在 AWS 东京区域(ap-northeast-1)处理。
              </li>
              <li>
                <span className="font-semibold">Mapbox</span>: 用于地图显示、拍摄地点位置信息显示和地点搜索。Mapbox 的隐私政策请参阅{' '}
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此处</a>。
              </li>
              <li>
                <span className="font-semibold">Google Analytics 4</span>: 用于服务改进的访问分析。收集页面浏览数、使用情况等匿名化数据。Google 的隐私政策请参阅{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此处</a>。
              </li>
              <li>
                <span className="font-semibold">Sentry</span>: 用于应用程序的错误监控。错误发生时发送技术性错误信息(仅发送全部错误的一部分)。Sentry 的隐私政策请参阅{' '}
                <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">此处</a>。
              </li>
              {/* Issue#106: MaxMind GeoLite2 (通过 IP 地址判定国家) */}
              <li>
                <span className="font-semibold">MaxMind GeoLite2</span>: 用于通过 IP 地址判定用户所在国家,以优化地图的初始显示位置。判定处理在服务器上执行,IP 地址仅用于转换为国家代码,不会被保存。本服务使用 GeoLite2 数据(Includes GeoLite2 data created by MaxMind, available from{' '}
                <a href="https://www.maxmind.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">https://www.maxmind.com</a>
                )。
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7条 (EXIF 信息的处理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方从用户投稿的照片文件中包含的 EXIF 信息自动提取拍摄日期时间、GPS 坐标、相机信息、镜头信息、拍摄设置值等。
          </li>
          <li>
            提取的拍摄信息(相机名称、镜头名称、焦距、光圈值、快门速度、ISO 感光度等)在本服务的 UI 上向其他用户显示。
          </li>
          <li>
            位置信息(GPS 坐标)作为拍摄地点显示在地图上。用户在投稿照片时,理解并同意位置信息将在本服务上公开后再进行投稿。
          </li>
          <li>
            本服务在投稿时自动从照片文件中删除 EXIF 信息后保存到服务器。但浏览器显示的图像在技术上可能被保存。运营方不保证图像数据的完整保护。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第7条之2 (社交登录相关信息的获取与处理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服务提供 Google 和 LINE 账户登录(以下简称「社交登录」)。使用社交登录时,用户需在各提供方的认证画面同意将电子邮箱等信息提供给本服务。
          </li>
          <li>
            获取的信息仅用于本服务的账户创建及与现有账户的关联目的。不用于 Google 广告或 LINE 广告等提供方的广告目的。
          </li>
          <li>
            社交登录附带的提供方发行的访问令牌,仅在退会时为撤销提供方一侧的访问权限(revoke)的目的而短期保存,使用 AES-256-GCM 加密后保存。revoke 完成后立即删除。
          </li>
          <li>
            用户退会时,社交登录获取的信息及本服务保存的 OAuth 关联信息将按照第11条规定的账户删除时数据处理进行删除。作为退会处理的一环,发送撤销提供方一侧访问权限的 revoke 请求。
          </li>
          <li>
            使用社交登录时,各提供方的隐私政策也一并适用。详细请参阅 Google 及 LINE 的官方隐私政策。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第8条 (内容自动审核)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方为确保内容政策的遵守,使用 AI 技术(Amazon Rekognition Content Moderation)对用户投稿的照片实施自动图像分析。
          </li>
          <li>
            自动审核分析投稿的图像是否属于不当内容(性表达、暴力表达、儿童的性剥削等)。图像数据在 AWS 东京区域处理,仅保存分析结果。
          </li>
          <li>
            被自动审核判定为不当的投稿将暂时处于非公开(隔离)状态,由运营方进行人工确认。
          </li>
          <li>
            自动审核的结果及违规历史出于内容审核及账户管理的目的进行保存。
          </li>
        </ol>
      </section>

      {/* Issue#119: AI 图像识别对类别・天气的自动判别 */}
      <section>
        <h2 className="mb-3">第8条之2 (类别和天气的自动判别)</h2>
        <p className="text-sm text-gray-700">
          发布的照片将发送至 AWS Rekognition(东京区域)进行图像分析,用于自动判别类别和天气。分析结果用于改进服务和提高搜索准确性。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第9条 (Cookie 等的使用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            本服务不使用认证目的的 Cookie。认证使用 JSON Web Token(JWT),通过以下方式保存在浏览器中。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>登录时选择「记住登录」时: localStorage(关闭浏览器后仍保留,有效期 24 小时)</li>
              <li>未选择时: sessionStorage(关闭浏览器后删除)</li>
            </ul>
          </li>
          <li>
            仅在社交登录流程中,为管理 OAuth 2.0 的 state 参数及 CSRF 对策,服务器发行必需 Cookie(<code>JSESSIONID</code>)。该 Cookie 以 SameSite=Lax、Secure 属性发行,在社交登录流程完成后或会话过期时失效。
          </li>
          <li>
            本服务使用 Google Analytics 4,Google 可能为收集访问信息而使用 Cookie。收集的数据已匿名化,不能识别个人。首次访问时显示 Cookie 同意横幅,用户可选择同意或拒绝。同意时进行使用 Cookie 的全面测量,拒绝时仅进行不使用 Cookie 的匿名基本测量。
          </li>
          <li>
            其他外部服务(Mapbox、Sentry 等)可能独自使用 Cookie。这些 Cookie 的处理请确认各服务的隐私政策。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第10条 (个人信息的公开、更正、删除)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            用户对自己的个人信息拥有以下权利。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>请求公开个人信息的权利</li>
              <li>请求更正、追加或删除个人信息的权利</li>
              <li>请求停止使用个人信息的权利</li>
            </ul>
          </li>
          <li>
            上述请求通过发送邮件至 support@photlas.jp 受理。运营方将在进行本人确认后,在合理期限内进行处理。
          </li>
          <li>
            个人资料信息的一部分(显示名称、头像图片、社交账户链接)用户可以自行在本服务上变更或删除。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第11条 (账户删除时的数据处理)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            用户退会时,以下数据出于不正使用的调查和处理目的保存 90 天后,连同备份完全删除。但根据使用条款已用于推广目的而公开的投稿数据除外。
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>账户信息(电子邮箱、显示名称等)</li>
              <li>个人资料信息(头像图片、社交账户链接)</li>
              <li>投稿数据(照片文件、元数据等)</li>
              <li>收藏、举报信息</li>
              <li>社交登录关联信息(OAuth 提供方关联记录、加密的访问令牌)</li>
            </ul>
          </li>
          <li>
            关于社交登录关联信息,作为退会处理的一环,异步尝试撤销(revoke)相应提供方(Google / LINE)的访问令牌。由此,本服务获取的对 Google / LINE 账户的访问权限将被迅速撤销。
          </li>
          <li>
            删除后的数据无法恢复。
          </li>
          <li>
            {/* Issue#105: 모더레이션 删除照片的 180 日保存公开 */}
            因内容审核被删除的照片及其元数据,出于复审、申诉处理目的保存 180 天后完全删除。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第12条 (未成年人的使用)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          {/* Issue#105: 13岁以上的使用限制 (符合 COPPA) */}
          <li>
            本服务面向<span className="font-semibold">年满 13周岁</span>的用户提供。未满 13周岁的人不能使用本服务。如发现未满 13周岁的人误注册,运营方将采取删除账户及相关数据的措施。
          </li>
          <li>
            年满 13周岁未满 18 周岁的未成年人使用本服务时,需取得法定代理人(监护人)的同意后方可使用。未成年人使用本服务时,视为已取得法定代理人的同意。
          </li>
          <li>
            关于未满 13周岁子女注册的监护人咨询,请联系第18条的咨询窗口。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第13条 (使用目的的变更)</h2>
        <p className="text-sm text-gray-700">
          仅在合理认定使用目的与变更前具有关联性的情况下,运营方将变更个人信息的使用目的。变更使用目的时,将就变更后的目的向用户通知或在本服务上公布。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第14条 (隐私政策的变更)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            运营方可能根据法律修订或服务变更而变更本政策。
          </li>
          <li>
            本政策进行重大变更时,事先向用户通知。
          </li>
          <li>
            变更后的隐私政策自在本服务上发布之时起生效。
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">第15条 (个人数据处理的法律依据)</h2>
        <p className="text-sm text-gray-700 mb-2">
          运营方基于以下法律依据处理个人数据。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">同意</span>(GDPR 第6条1款(a)): Google Analytics 4 进行的访问分析。用户可通过 Cookie 同意横幅选择同意或拒绝。</li>
          <li><span className="font-semibold">合同履行</span>(GDPR 第6条1款(b)): 账户管理、服务提供、地图功能(Mapbox)的提供。</li>
          <li><span className="font-semibold">正当利益</span>(GDPR 第6条1款(f)): 错误监控(Sentry)、不正使用的检测和防止、服务安全性的确保、基于 IP 地址判定国家以优化初始显示位置(提升用户便利性)。</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第16条 (基于欧盟一般数据保护条例(GDPR)的权利)</h2>
        <p className="text-sm text-gray-700 mb-2">
          居住在欧洲经济区(EEA)的用户根据 GDPR 享有以下权利。希望行使这些权利时,请联系 support@photlas.jp。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">访问权</span>: 请求自己个人数据副本的权利</li>
          <li><span className="font-semibold">更正权</span>: 请求更正不准确个人数据的权利</li>
          <li><span className="font-semibold">删除权(被遗忘权)</span>: 请求删除个人数据的权利</li>
          <li><span className="font-semibold">处理限制权</span>: 请求限制个人数据处理的权利</li>
          <li><span className="font-semibold">数据可携带权</span>: 以结构化、机器可读格式接收个人数据的权利。行使本权利时,可随时在账号设置的&quot;导出数据&quot;中将您的数据下载为 ZIP 文件。</li>
          <li><span className="font-semibold">异议权</span>: 对基于正当利益的处理提出异议的权利</li>
          <li><span className="font-semibold">同意撤回权</span>: 对基于同意的处理随时撤回同意的权利(从浏览器设置删除本网站的网站数据后,Cookie 同意横幅会再次显示,可撤回同意)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">第17条 (国际数据传输)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: 国际用户的综合性提示 */}
          本服务由设立于日本的运营方提供,可在全球访问。即使从日本境外访问,用户的个人数据也会传输至日本服务器后处理。
        </p>
        <p className="text-sm text-gray-700 mb-2">
          用户的个人数据可能在服务提供所必需的范围内传输至以下地区。
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">日本(AWS 东京区域)</span>: 图像文件保存与分发、数据库、内容审核</li>
          <li><span className="font-semibold">美国</span>: Google Analytics 4 进行的访问分析数据、Sentry 进行的错误监控数据</li>
        </ul>
        <p className="text-sm text-gray-700 mt-2">
          这些服务提供方根据各自的隐私政策及数据处理协议采取了适当的数据保护措施。
        </p>
        <p className="text-sm text-gray-700 mt-2">
          {/* Issue#105: 尊重用户居住国法律授予的权利 */}
          根据用户居住国家的法律,如享有本政策未记载的额外权利,运营方将尊重这些权利,并按照适用法律法规的规定进行处理。
        </p>
      </section>

      <section>
        <h2 className="mb-3">第18条 (咨询窗口)</h2>
        <p className="text-sm text-gray-700">
          关于本政策的咨询,请联系以下窗口。
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
