/**
 * PrivacyContentKo コンポーネント
 * Issue#101: 프라이버시 정책 본문 (한국어)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 */
export function PrivacyContentKo() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          Photlas 운영자(이하 「운영자」)는 본 서비스 「Photlas」(이하 「본 서비스」)에서 사용자의 개인정보 처리에 관하여 다음과 같이 개인정보 처리방침(이하 「본 방침」)을 정합니다. 운영자는 일본 「개인정보 보호에 관한 법률(개인정보 보호법)」 및 기타 관련 법령을 준수하며, 사용자의 개인정보를 적절하게 처리합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제1조 (기본 방침)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 개인정보 보호를 중요한 책무로 인식하고, 일본 개인정보 보호법 및 기타 관련 법령과 가이드라인을 준수하며, 본 방침에 따라 개인정보를 적정하게 처리합니다. 본 방침은 본 서비스(photlas.jp)에서의 개인정보 처리에 관하여 정합니다.
        </p>
        <p className="text-sm text-gray-700">
          본 방침에서 「개인정보」란 일본 개인정보 보호법에서 정의하는 「개인정보」를 의미하며, 생존하는 개인에 관한 정보로서 해당 정보에 포함된 이메일 주소, 표시명 등의 기재 등에 의해 특정 개인을 식별할 수 있는 정보를 말합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제2조 (수집하는 정보)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 본 서비스 제공을 위해 다음 정보를 수집합니다.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(1) 계정 정보</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>이메일 주소</li>
          <li>표시명</li>
          <li>비밀번호 (암호화하여 저장)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(2) 프로필 정보</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>프로필 이미지</li>
          <li>SNS 계정 링크 (최대 3건)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(3) 게시 데이터</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>사진 파일</li>
          <li>제목, 시설명, 카테고리, 날씨 정보</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(4) 사진 메타데이터 (EXIF 정보)</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>촬영 일시</li>
          <li>GPS 좌표 (위도/경도)</li>
          <li>카메라 본체명</li>
          <li>렌즈명</li>
          <li>초점거리, F값, 셔터 스피드, ISO 감도</li>
          <li>이미지 크기</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(5) 위치 정보</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>촬영 지점의 GPS 좌표 (사진의 EXIF 정보에서 자동 취득, 또는 사용자에 의한 수동 입력)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(6) 이용 데이터</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>즐겨찾기 등록 정보</li>
          <li>신고 정보 (신고 사유, 신고 대상)</li>
          <li>콘텐츠 모더레이션 정보 (심사 결과, 위반 이력, 제재 정보)</li>
          <li>위치 정보 지적 데이터 (지적 지점의 좌표, 지적 상태)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(7) 기술 정보</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>
            WAF 로그 (AWS WAF가 수집하는 IP 주소, 요청 URL, User-Agent, 액세스 시각.
            이용 목적은 속도 제한 제어 및 부정 액세스 탐지·조사.
            보관 기간은 최대 90일이며, 보관 기간 경과 후에는 자동으로 삭제됩니다)
          </li>
          <li>오류 정보 (외부 서비스 「Sentry」를 통해 수집. 전체 오류의 일부만 전송됨)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(8) SNS 로그인 인증 정보</h3>
        <p className="text-sm text-gray-700 mb-1">
          사용자가 Google 또는 LINE 계정으로 본 서비스에 로그인한 경우, 각 제공자로부터 다음 정보를 취득합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Google: 이메일 주소, Google 사용자 ID (<code>sub</code> 클레임)</li>
          <li>LINE: 이메일 주소, 표시명, LINE 사용자 ID</li>
        </ul>
        <p className="text-sm text-gray-700 mt-1">
          또한 Google 또는 LINE 측에서 관리하는 인증 정보(비밀번호 등)는 본 서비스에서 일체 보유하지 않습니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제3조 (정보 수집 방법)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 다음 방법으로 정보를 수집합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>사용자가 직접 입력하는 정보 (계정 등록 시, 프로필 편집 시, 사진 게시 시)</li>
          <li>사진 파일에서 자동으로 추출하는 정보 (EXIF 정보에 포함된 촬영 일시, GPS 좌표, 카메라 정보 등)</li>
          <li>서비스 이용 시 자동으로 취득하는 정보 (IP 주소, 오류 정보)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제4조 (정보의 이용 목적)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자가 개인정보를 수집·이용하는 목적은 다음과 같습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>본 서비스의 제공·운영·개선</li>
          <li>사용자의 본인 확인·인증</li>
          <li>사진 촬영 지점을 지도에 표시하는 기능 제공</li>
          <li>사진의 촬영 정보(카메라, 렌즈, 설정값 등) 표시</li>
          <li>신기능·업데이트·유지보수 등에 관한 사용자 알림</li>
          <li>비밀번호 재설정 대응</li>
          <li>부정 이용 탐지·방지 (속도 제한, 부정 액세스 방지)</li>
          <li>이용약관 위반 대응</li>
          <li>본 서비스의 광고·홍보·프로모션 (게시 데이터의 이용)</li>
          <li>사용자 문의 대응</li>
          {/* Issue#106: IP 주소로부터의 국가 판정 */}
          <li>IP 주소를 기반으로 한 사용자의 소재 국가 판정 (지도의 초기 표시 위치 최적화를 위함. IP 주소는 서버에 저장되지 않으며, 국가 코드로의 변환에만 사용됩니다)</li>
          <li>위 이용 목적에 부수하는 목적</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제5조 (정보 저장·보안)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 수집한 정보를 다음 방법으로 안전하게 관리합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>비밀번호는 BCrypt로 암호화(해시화)하여 저장하며, 운영자를 포함한 누구도 원래 비밀번호를 열람할 수 없습니다.</li>
          <li>사진 파일 및 프로필 이미지는 Amazon Web Services(AWS) 클라우드 스토리지에 저장합니다.</li>
          <li>인증에는 JSON Web Token(JWT)을 사용하며, 토큰은 사용자 브라우저에 저장됩니다.</li>
          <li>모든 통신은 HTTPS로 암호화되어 이루어집니다.</li>
          <li>부정 액세스 방지를 위해 액세스 빈도 제한(속도 제한)을 실시하고 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제6조 (제3자 제공·외부 서비스 이용)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: Do Not Sell 선언 */}
          운영자는 사용자의 개인정보를 제3자에게 판매하지 않습니다.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 다음 경우를 제외하고 사전에 사용자의 동의를 얻지 않고 제3자에게 개인정보를 제공하지 않습니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>법령에 근거한 경우</li>
              <li>사람의 생명, 신체 또는 재산 보호를 위해 필요한 경우로서, 본인의 동의를 얻기 어려운 때</li>
              <li>공중위생 향상 또는 아동의 건전한 육성 추진을 위해 특히 필요한 경우로서, 본인의 동의를 얻기 어려운 때</li>
              <li>국가 기관 또는 지방 공공단체 또는 그로부터 위탁받은 자가 법령에 정해진 사무를 수행하는 데 협력할 필요가 있는 경우로서, 본인의 동의를 얻음으로써 해당 사무 수행에 지장을 줄 우려가 있을 때</li>
            </ul>
          </li>
          <li>
            운영자는 본 서비스에 관한 사업을 다른 자에게 양도한 경우, 해당 사업 양도에 따라 개인정보를 해당 사업 양도의 양수인에게 제공할 수 있습니다.
          </li>
          <li>
            운영자는 본 서비스 제공에 있어서 다음 외부 서비스를 이용하고 있습니다. 이러한 서비스에 사용자 정보의 일부가 전송되는 경우가 있습니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <span className="font-semibold">Amazon Web Services (AWS S3, CloudFront, SES, Rekognition)</span>: 이미지 파일 저장·전송, 메일 송신, 콘텐츠 자동 심사에 사용합니다. 데이터는 AWS 도쿄 리전(ap-northeast-1)에서 처리됩니다.
              </li>
              <li>
                <span className="font-semibold">Mapbox</span>: 지도 표시, 촬영 지점 위치 정보 표시, 장소 검색에 사용합니다. Mapbox의 개인정보 처리방침은{' '}
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">여기</a>{' '}
                를 참조하십시오.
              </li>
              <li>
                <span className="font-semibold">Google Analytics 4</span>: 서비스 개선을 위한 액세스 분석에 사용합니다. 페이지 열람수, 이용 상황 등의 익명화된 데이터를 수집합니다. Google의 개인정보 처리방침은{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">여기</a>{' '}
                를 참조하십시오.
              </li>
              <li>
                <span className="font-semibold">Sentry</span>: 애플리케이션 오류 모니터링에 사용합니다. 오류 발생 시 기술적인 오류 정보가 전송됩니다(전체 오류의 일부만). Sentry의 개인정보 처리방침은{' '}
                <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">여기</a>{' '}
                를 참조하십시오.
              </li>
              {/* Issue#106: MaxMind GeoLite2 (IP 주소로부터의 국가 판정) */}
              <li>
                <span className="font-semibold">MaxMind GeoLite2</span>: IP 주소로부터 사용자의 소재 국가를 판정하여 지도의 초기 표시 위치를 최적화하기 위해 사용합니다. 판정 처리는 서버에서 실행되며, IP 주소는 국가 코드로의 변환에만 사용되고 저장되지 않습니다. 본 서비스는 GeoLite2 데이터를 사용합니다(Includes GeoLite2 data created by MaxMind, available from{' '}
                <a href="https://www.maxmind.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">https://www.maxmind.com</a>
                ).
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제7조 (EXIF 정보의 처리)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 사용자가 게시한 사진 파일에 포함된 EXIF 정보로부터 촬영 일시, GPS 좌표, 카메라 정보, 렌즈 정보, 촬영 설정값 등을 자동으로 추출합니다.
          </li>
          <li>
            추출된 촬영 정보(카메라명, 렌즈명, 초점거리, F값, 셔터 스피드, ISO 감도 등)는 본 서비스 UI에서 다른 사용자에게 표시됩니다.
          </li>
          <li>
            위치 정보(GPS 좌표)는 촬영 스팟으로서 지도에 표시됩니다. 사용자는 사진 게시 시 위치 정보가 본 서비스에서 공개되는 것을 이해하고 동의한 후에 게시하는 것으로 합니다.
          </li>
          <li>
            본 서비스에서는 게시 시 사진 파일에서 EXIF 정보를 자동으로 삭제한 후 서버에 저장합니다. 단, 브라우저에 표시되는 이미지는 기술적으로 저장될 가능성이 있습니다. 운영자는 이미지 데이터의 완전한 보호를 보장하지 않습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제7조의2 (SNS 로그인에 관한 정보의 취득과 처리)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            본 서비스에서는 Google 및 LINE 계정에 의한 로그인(이하 「SNS 로그인」)을 제공하고 있습니다. SNS 로그인을 이용하는 경우, 사용자는 각 제공자의 인증 화면에서 이메일 주소 등의 정보를 본 서비스에 제공하는 데 동의해야 합니다.
          </li>
          <li>
            취득한 정보는 본 서비스의 계정 작성 및 기존 계정과의 연결 목적으로만 사용합니다. Google 광고나 LINE 광고 등 제공자의 광고 목적으로는 이용하지 않습니다.
          </li>
          <li>
            SNS 로그인에 따라 제공자로부터 발행되는 액세스 토큰은 회원 탈퇴 시 제공자 측의 액세스 권한을 취소(revoke)할 목적으로만 단기간 보유하며, AES-256-GCM으로 암호화한 후 저장합니다. revoke 완료 후에는 신속히 삭제합니다.
          </li>
          <li>
            사용자가 회원 탈퇴한 경우, SNS 로그인으로 취득한 정보 및 본 서비스 측에서 보유하는 OAuth 연계 정보는 제11조에 정한 계정 삭제 시의 데이터 처리에 따라 삭제됩니다. 회원 탈퇴 처리의 일환으로 제공자 측의 액세스 권한을 취소하는 revoke 요청을 송신합니다.
          </li>
          <li>
            SNS 로그인의 이용에 있어서는 각 제공자의 개인정보 처리방침도 함께 적용됩니다. 자세한 내용은 Google 및 LINE의 공식 개인정보 처리방침을 참조하십시오.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제8조 (콘텐츠 자동 심사)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 콘텐츠 정책 준수를 보장하기 위해 사용자가 게시한 사진에 대해 AI 기술(Amazon Rekognition Content Moderation)을 이용한 자동 이미지 분석을 실시합니다.
          </li>
          <li>
            자동 심사에서는 게시된 이미지가 부적절한 콘텐츠(성적 표현, 폭력적 표현, 아동의 성적 착취 등)에 해당하는지 분석합니다. 이미지 데이터는 AWS 도쿄 리전에서 처리되며, 분석 결과만 저장됩니다.
          </li>
          <li>
            자동 심사에 의해 부적절하다고 판단된 게시는 일시적으로 비공개(격리) 상태가 되며, 운영자에 의한 인적 확인이 진행됩니다.
          </li>
          <li>
            자동 심사 결과 및 위반 이력은 콘텐츠 모더레이션 및 계정 관리 목적으로 저장됩니다.
          </li>
        </ol>
      </section>

      {/* Issue#119: AI 이미지 인식에 의한 카테고리・날씨 자동 판별 */}
      <section>
        <h2 className="mb-3">제8조의2 (카테고리와 날씨의 자동 판별)</h2>
        <p className="text-sm text-gray-700">
          게시된 사진은 카테고리와 날씨 자동 판별을 위해 AWS Rekognition(도쿄 리전)에 전송되어 이미지 분석됩니다. 분석 결과는 서비스 개선 및 검색 정확도 향상을 위해 이용됩니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제9조 (Cookie 등의 이용)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            본 서비스에서는 인증 목적의 Cookie는 사용하지 않습니다. 인증에는 JSON Web Token(JWT)을 사용하며, 다음 방법으로 브라우저에 저장합니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>로그인 시 「로그인 기억하기」를 선택한 경우: localStorage(브라우저를 닫아도 유지되며 24시간 유효)</li>
              <li>선택하지 않은 경우: sessionStorage(브라우저를 닫으면 삭제됨)</li>
            </ul>
          </li>
          <li>
            SNS 로그인 흐름 중에 한해, OAuth 2.0의 state 파라미터 관리 및 CSRF 대책을 위해 서버가 필수 Cookie(<code>JSESSIONID</code>)를 발행합니다. 이 Cookie는 SameSite=Lax, Secure 속성으로 발행되며, SNS 로그인 흐름 완료 후 또는 세션 만료 시 무효화됩니다.
          </li>
          <li>
            본 서비스에서는 Google Analytics 4를 이용하고 있으며, Google이 액세스 정보 수집을 위해 Cookie를 사용하는 경우가 있습니다. 수집되는 데이터는 익명화되어 있어 개인을 특정하는 것은 아닙니다. 첫 방문 시 Cookie 동의 배너가 표시되며, 사용자는 동의 또는 거부를 선택할 수 있습니다. 동의한 경우 Cookie를 사용한 전체 측정이 이루어지며, 거부한 경우 Cookie를 사용하지 않는 익명 기본 측정만 이루어집니다.
          </li>
          <li>
            기타 외부 서비스(Mapbox, Sentry 등)가 독자적으로 Cookie를 사용하는 경우가 있습니다. 이러한 Cookie의 처리에 대해서는 각 서비스의 개인정보 처리방침을 확인하십시오.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제10조 (개인정보의 공개·정정·삭제)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            사용자는 자신의 개인정보에 대해 다음 권리를 가집니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>개인정보의 공개를 청구할 권리</li>
              <li>개인정보의 정정, 추가 또는 삭제를 청구할 권리</li>
              <li>개인정보의 이용 정지를 청구할 권리</li>
            </ul>
          </li>
          <li>
            위 청구는 support@photlas.jp로의 이메일로 접수합니다. 운영자는 본인 확인을 진행한 후, 합리적인 기간 내에 대응하겠습니다.
          </li>
          <li>
            프로필 정보의 일부(표시명, 프로필 이미지, SNS 계정 링크)는 사용자 본인이 본 서비스에서 변경·삭제할 수 있습니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제11조 (계정 삭제 시 데이터 처리)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            사용자가 회원 탈퇴한 경우, 다음 데이터는 부정 이용의 조사·대응을 목적으로 90일간 보관한 후, 백업을 포함하여 완전히 삭제합니다. 단, 이용약관에 근거하여 프로모션 목적으로 이미 공개된 게시 데이터에 대해서는 그러하지 않습니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>계정 정보(이메일 주소, 표시명 등)</li>
              <li>프로필 정보(프로필 이미지, SNS 계정 링크)</li>
              <li>게시 데이터(사진 파일, 메타데이터 등)</li>
              <li>즐겨찾기·신고 정보</li>
              <li>SNS 로그인 연계 정보(OAuth 제공자 연계 레코드, 암호화된 액세스 토큰)</li>
            </ul>
          </li>
          <li>
            SNS 로그인 연계 정보에 대해서는, 회원 탈퇴 처리의 일환으로 해당 제공자(Google / LINE)의 액세스 토큰 취소(revoke)를 비동기적으로 시도합니다. 이로써 본 서비스가 취득했던 Google / LINE 계정에 대한 액세스 권한은 신속히 취소됩니다.
          </li>
          <li>
            삭제 후 데이터 복구는 불가능합니다.
          </li>
          <li>
            {/* Issue#105: 모더레이션 삭제 사진의 180일 보유 공개 */}
            콘텐츠 모더레이션에 의해 삭제된 사진 및 그 메타데이터는 재심사·이의 신청 대응을 목적으로 180일간 보관한 후 완전히 삭제됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제12조 (미성년자의 이용)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          {/* Issue#105: 만 13세 이상의 이용 제한을 명시 (COPPA 준거) */}
          <li>
            본 서비스는 <span className="font-semibold">만 13세 이상</span>인 분을 대상으로 제공합니다. 만 13세 미만의 분은 본 서비스를 이용할 수 없습니다. 잘못하여 만 13세 미만의 분이 등록한 것이 판명된 경우, 운영자는 계정 및 관련 데이터를 삭제하는 조치를 취합니다.
          </li>
          <li>
            만 13세 이상 18세 미만의 미성년자가 본 서비스를 이용하는 경우, 법정 대리인(보호자)의 동의를 얻은 후 이용하는 것으로 합니다. 미성년자가 본 서비스를 이용한 경우, 법정 대리인의 동의를 얻은 것으로 간주합니다.
          </li>
          <li>
            만 13세 미만 자녀의 등록에 관한 보호자로부터의 문의는 제18조의 문의 창구로 연락 주십시오.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제13조 (이용 목적의 변경)</h2>
        <p className="text-sm text-gray-700">
          운영자는 이용 목적이 변경 전과 관련성을 가진다고 합리적으로 인정되는 경우에 한하여 개인정보의 이용 목적을 변경하기로 합니다. 이용 목적의 변경을 한 경우에는 변경 후의 목적에 대해 사용자에게 통지하거나 본 서비스에 공표하기로 합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제14조 (개인정보 처리방침의 변경)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 법령의 개정이나 서비스의 변경에 따라 본 방침을 변경하는 경우가 있습니다.
          </li>
          <li>
            본 방침의 중요한 변경을 진행하는 경우는 사전에 사용자에게 통지하기로 합니다.
          </li>
          <li>
            변경 후의 개인정보 처리방침은 본 서비스에 게재한 시점부터 효력을 발생시키기로 합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제15조 (개인 데이터 처리의 법적 근거)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 다음 법적 근거에 기초하여 개인 데이터를 처리합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">동의</span>(GDPR 제6조 1항(a)): Google Analytics 4에 의한 액세스 분석. 사용자는 Cookie 동의 배너에 의해 동의 또는 거부를 선택할 수 있습니다.</li>
          <li><span className="font-semibold">계약 이행</span>(GDPR 제6조 1항(b)): 계정 관리, 서비스 제공, 지도 기능(Mapbox)의 제공.</li>
          <li><span className="font-semibold">정당한 이익</span>(GDPR 제6조 1항(f)): 오류 모니터링(Sentry), 부정 이용 탐지·방지, 서비스 안전성 확보, IP 주소로부터의 국가 판정에 의한 초기 표시 위치 최적화(사용자 편의성 향상).</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제16조 (EU 일반 데이터 보호 규칙(GDPR)에 의한 권리)</h2>
        <p className="text-sm text-gray-700 mb-2">
          유럽 경제 영역(EEA)에 거주하는 사용자는 GDPR에 따라 다음 권리를 가집니다. 이러한 권리의 행사를 희망하는 경우는 support@photlas.jp로 연락 주십시오.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">액세스권</span>: 자신의 개인 데이터 사본을 청구할 권리</li>
          <li><span className="font-semibold">정정권</span>: 부정확한 개인 데이터의 정정을 청구할 권리</li>
          <li><span className="font-semibold">삭제권(잊혀질 권리)</span>: 개인 데이터의 삭제를 청구할 권리</li>
          <li><span className="font-semibold">처리 제한권</span>: 개인 데이터의 처리 제한을 청구할 권리</li>
          <li><span className="font-semibold">데이터 이동성권</span>: 개인 데이터를 구조화된 기계 가독 형식으로 받을 권리. 본 권리를 행사하실 경우, 계정 설정 화면의 &quot;데이터 내보내기&quot;에서 언제든지 회원님의 데이터를 ZIP 파일로 다운로드하실 수 있습니다.</li>
          <li><span className="font-semibold">이의 신청권</span>: 정당한 이익에 기초한 처리에 대해 이의를 제기할 권리</li>
          <li><span className="font-semibold">동의 철회권</span>: 동의에 기초한 처리에 대해 언제든지 동의를 철회할 권리(브라우저 설정에서 본 사이트의 사이트 데이터를 삭제하면 Cookie 동의 배너가 다시 표시되어 동의를 철회할 수 있습니다)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제17조 (국제 데이터 이전)</h2>
        <p className="text-sm text-gray-700 mb-2">
          {/* Issue#105: 국제 사용자를 위한 포괄적 주의사항을 추가 */}
          본 서비스는 일본에 거점을 둔 사업자에 의해 제공되며, 전 세계에서 액세스 가능합니다. 일본 국외에서 액세스된 경우에도 사용자의 개인 데이터는 일본의 서버로 전송된 후 처리됩니다.
        </p>
        <p className="text-sm text-gray-700 mb-2">
          사용자의 개인 데이터는 서비스 제공에 필요한 범위에서 다음 지역으로 이전될 수 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">일본(AWS 도쿄 리전)</span>: 이미지 파일 저장·전송, 데이터베이스, 콘텐츠 심사</li>
          <li><span className="font-semibold">미국</span>: Google Analytics 4에 의한 액세스 분석 데이터, Sentry에 의한 오류 모니터링 데이터</li>
        </ul>
        <p className="text-sm text-gray-700 mt-2">
          이러한 서비스 제공자는 각각의 개인정보 처리방침 및 데이터 처리 계약에 기초하여 적절한 데이터 보호 조치를 강구하고 있습니다.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          {/* Issue#105: 사용자가 거주하는 국가의 법률에 의한 권리를 존중 */}
          사용자가 거주하는 국가의 법률에 의해 본 방침에 기재되지 않은 추가 권리를 가지는 경우, 운영자는 그러한 권리를 존중하고 적용 법령의 정한 바에 따라 대응합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제18조 (문의 창구)</h2>
        <p className="text-sm text-gray-700">
          본 방침에 관한 문의는 다음 창구로 연락 주십시오.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          운영자명: Photlas 운영자<br />
          이메일 주소: support@photlas.jp
        </p>
      </section>

      <section className="pt-6 border-t">
        <p className="text-sm text-gray-500">
          제정일: 2026년 2월 16일<br />
          최종 개정일: 2026년 5월 1일 (국제 대응판으로 갱신)
        </p>
      </section>
    </div>
  )
}
