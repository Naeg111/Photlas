/**
 * TermsContentKo コンポーネント
 * Issue#101: 이용약관 본문 (한국어)
 *
 * 注: Issue#101 Phase: 機械翻訳ベースで作成。法的妥当性については、
 * 海外ユーザー本格対応時に専門家レビューを実施予定。
 */
export function TermsContentKo() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          본 이용약관(이하 「본 약관」)은 Photlas 운영자(이하 「운영자」)가 제공하는 서비스 「Photlas」(이하 「본 서비스」)의 제공 조건 및 본 서비스의 이용에 관한 운영자와 사용자 간의 권리 의무 관계를 정하는 것을 목적으로 합니다. 본 서비스를 이용하시기 전에 본 약관을 잘 읽어 주십시오.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제1조 (적용)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            본 약관은 본 서비스의 제공 조건 및 본 서비스의 이용에 관한 운영자와 사용자 간의 권리 의무 관계를 정하는 것을 목적으로 하며, 사용자와 운영자 간의 본 서비스 이용에 관련된 모든 관계에 적용됩니다.
          </li>
          <li>
            사용자는 본 서비스를 이용함으로써 본 약관의 모든 조항에 동의한 것으로 간주됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제2조 (정의)</h2>
        <p className="text-sm text-gray-700 mb-2">
          본 약관에서 사용하는 다음 용어는 각각 다음에 정한 의미를 가지는 것으로 합니다.
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>「본 서비스」란 운영자가 제공하는 「Photlas」(photlas.jp)라는 명칭의 웹 서비스를 의미합니다.</li>
          <li>「사용자」란 본 약관에 동의한 후, 본 서비스를 이용하는 모든 분을 의미합니다.</li>
          <li>「등록 사용자」란 본 서비스에 계정 등록을 완료한 사용자를 의미합니다.</li>
          <li>
            「게시 데이터」란 사용자가 본 서비스를 이용하여 게시 또는 기타 송신한 콘텐츠를 의미하며, 다음을 포함하지만 이에 한정되지 않습니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>사진 파일</li>
              <li>촬영 메타데이터(위치 정보, 촬영 일시, 카메라 정보, 렌즈 정보, 촬영 설정값 등)</li>
              <li>제목, 시설명, 카테고리 선택, 날씨 정보</li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제3조 (사용자 등록)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            {/* Issue#105: 만 13세 이상의 이용 제한을 명시 (개인정보 처리방침 제12조와 정합) */}
            본 서비스는 <span className="font-semibold">만 13세 이상</span>의 분을 대상으로 제공합니다. 만 13세 미만의 분은 사용자 등록 및 본 서비스의 이용을 할 수 없습니다.
          </li>
          <li>
            본 서비스의 일부 기능 이용을 희망하는 분은 본 약관을 준수하는 것에 동의하고, 운영자가 정한 방법에 따라 사용자 등록을 신청하는 것으로 합니다. 등록에는 이메일 주소, 표시명 및 비밀번호의 입력이 필요합니다.
          </li>
          <li>
            사용자는 등록 정보에 대해 정확하고 최신 정보를 유지하는 것으로 하며, 등록 정보에 변경이 발생한 경우는 신속히 수정하는 것으로 합니다.
          </li>
          <li>
            운영자는 등록 희망자가 다음 각 호의 사유에 해당하는 경우는 등록을 거부할 수 있으며, 그 이유에 대해 일체의 공개 의무를 지지 않는 것으로 합니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>등록 내용에 허위 사항을 신고한 경우</li>
              <li>과거에 본 약관 위반 등으로 등록이 말소된 적이 있는 경우</li>
              <li>기타 운영자가 등록을 적절하지 않다고 판단한 경우</li>
            </ul>
          </li>
          <li>
            등록 사용자는 자신의 계정 및 비밀번호를 적절히 관리할 책임을 지는 것으로 하며, 이를 제3자에게 이용하게 하거나 대여, 양도, 명의 변경, 매매 등을 하지 않는 것으로 합니다.
          </li>
          <li>
            1인의 사용자가 여러 계정을 작성하는 것은 금지합니다.
          </li>
          <li>
            Google 계정 또는 LINE 계정에 의한 소셜 사인인(이하 「SNS 로그인」)을 이용하는 경우, 사용자는 본 약관에 더하여 해당 제공자(Google 또는 LINE 주식회사)가 정한 이용약관 및 개인정보 처리방침에도 따르는 것으로 합니다. 제공자 측의 약관 위반 등에 의해 제공자 계정의 정지·제한이 이루어진 경우, 본 서비스 측의 계정에도 정지 등의 조치가 미칠 수 있습니다.
          </li>
          <li>
            SNS 로그인을 이용하는 경우, 사용자는 본 서비스가 해당 제공자로부터 이메일 주소·성명 등의 정보를 취득하여 본 서비스의 계정 작성 또는 기존 계정과의 연결에 사용하는 것에 동의하는 것으로 합니다. 취득하는 정보의 자세한 내용은 개인정보 처리방침 제2조 및 제7조의2를 참조하십시오.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제4조 (게시 데이터의 처리)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            게시 데이터의 저작권은 해당 게시 데이터를 게시한 사용자에게 귀속됩니다.
          </li>
          <li>
            사용자는 게시 데이터에 대해, 스스로가 게시 또는 기타 송신하는 것에 대한 적법한 권리를 가지고 있다는 것 및 게시 데이터가 제3자의 지적 재산권, 초상권, 프라이버시권 및 기타 권리를 침해하지 않는다는 것에 대해, 운영자에 대해 표명하고 보증하는 것으로 합니다.
          </li>
          <li>
            사용자는 게시 데이터에 대해, 운영자에 대해, 다음 이용을 허락하는 비독점적, 무상, 지역 제한 없는 라이선스를 부여하는 것으로 합니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>본 서비스의 제공·운영에 필요한 범위에서의 이용(표시, 전송, 저장, 복제 등)</li>
              <li>본 서비스의 광고·홍보·프로모션 목적의 이용(SNS 게시, 광고 소재 등)</li>
              <li>본 서비스의 제공에 필요한 범위에서의 제3자에 대한 서브라이선스(CDN 전송 업체 등)</li>
            </ul>
          </li>
          <li>
            사용자는 운영자 및 운영자가 허락한 제3자에 대해, 게시 데이터에 관한 저작자 인격권을 행사하지 않을 것에 동의하는 것으로 합니다.
          </li>
          <li>
            사용자가 회원 탈퇴한 경우라도, 회원 탈퇴 전에 프로모션 목적으로 이미 이용된 게시 데이터에 대해서는 운영자가 계속해서 이용할 수 있는 것으로 합니다.
          </li>
          <li>
            다른 사용자는 게시 데이터에 포함된 촬영 지점의 위치 정보가 정확하지 않다고 판단한 경우, 정확하다고 생각되는 지점을 지적할 수 있습니다. 게시자는 지적을 확인하고 수용 또는 거부의 판단을 행하는 것으로 합니다. 게시자가 지적을 수용한 경우, 촬영 지점의 위치 정보가 갱신됩니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제5조 (금지 사항)</h2>
        <p className="text-sm text-gray-700 mb-2">
          사용자는 본 서비스의 이용에 있어서 다음 행위를 해서는 안 됩니다.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
          <li>법령 또는 공서양속에 위반되는 행위</li>
          <li>범죄 행위와 관련된 행위</li>
          <li>운영자, 다른 사용자, 또는 기타 제3자의 지적 재산권, 초상권, 프라이버시권 및 기타 권리를 침해하는 행위</li>
          <li>타인의 저작물을 권리자의 허락 없이 게시하는 행위</li>
          <li>인물을 특정할 수 있는 사진을 본인의 동의 없이 게시하는 행위</li>
          <li>사유지에 대한 무단 진입을 조장하는 행위, 또는 위험한 장소로의 액세스를 권장하는 행위</li>
          <li>운영자의 서버 또는 네트워크의 기능을 파괴하거나 방해하는 행위</li>
          <li>본 서비스에 대한 리버스 엔지니어링, 스크래핑 등의 행위</li>
          <li>본 서비스에 의해 얻어진 정보를 운영자의 허락 없이 상업적으로 이용하는 행위</li>
          <li>부정 액세스를 하거나 이를 시도하는 행위</li>
          <li>다른 사용자에 관한 개인정보 등을 수집 또는 축적하는 행위</li>
          <li>다른 사용자를 사칭하는 행위</li>
          <li>1인이 여러 계정을 작성·운용하는 행위</li>
          <li>반사회적 세력에 대해 직접 또는 간접적으로 이익을 공여하는 행위</li>
          <li>
            다음에 해당하는 콘텐츠를 게시하는 행위
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>외설, 노골적인 성적 표현을 포함하는 콘텐츠</li>
              <li>폭력적, 잔혹한 표현을 포함하는 콘텐츠</li>
              <li>아동의 성적 착취에 관한 콘텐츠(CSAM/IHC)</li>
              <li>차별적, 헤이트 스피치에 해당하는 콘텐츠</li>
              <li>기타 불쾌감을 주는 콘텐츠</li>
            </ul>
          </li>
          <li>본 서비스의 운영을 방해할 우려가 있는 행위</li>
          <li>기타 운영자가 부적절하다고 판단하는 행위</li>
        </ol>
        {/* Issue#105: 게시자 책임의 강화 (촬영지국의 법령 준수) */}
        <p className="text-sm text-gray-700 mt-3 font-semibold">게시자의 책임 (국제 이용에 관한 추가 사항)</p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 mt-1">
          <li>
            사용자는 게시하는 사진에 대해, <span className="font-semibold">촬영지국의 법령</span>(초상권, 프라이버시권, 건축물의 촬영 금지 규제 등)을 준수할 책임을 집니다.
          </li>
          <li>
            사진에 제3자가 식별 가능한 형태로 비치는 경우, 사용자는 해당 인물의 <span className="font-semibold">동의를 취득</span>하거나, 또는 개인을 특정할 수 없도록 가공한 후 게시할 책임을 집니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제6조 (이용 요금)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            본 서비스는 현시점에서는 무료로 제공합니다.
          </li>
          <li>
            운영자는 장래에 유료 기능을 도입하는 경우가 있습니다. 그 경우는 사전에 사용자에게 통지하는 것으로 합니다.
          </li>
          <li>
            유료 기능의 이용 요금, 지불 방법 및 기타 조건은 별도 운영자가 정하는 바에 따릅니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제7조 (회원 탈퇴·계정 삭제)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            등록 사용자는 운영자가 정한 절차에 따라 언제든지 회원 탈퇴하여 계정을 삭제할 수 있습니다.
          </li>
          <li>
            회원 탈퇴 후, 사용자의 개인정보 및 게시 데이터는 부정 이용의 조사·대응을 목적으로 90일간 보관한 후 완전히 삭제됩니다. 단, 제4조 제5항에 정하는 프로모션 목적으로 이미 이용된 게시 데이터에 대해서는 그러하지 않습니다.
          </li>
          <li>
            회원 탈퇴 후의 계정 복구는 불가능합니다.
          </li>
          <li>
            회원 탈퇴 후 90일간은 회원 탈퇴 시 등록되어 있던 이메일 주소로의 재등록은 불가능합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제8조 (등록 말소)</h2>
        <p className="text-sm text-gray-700 mb-2">
          운영자는 사용자가 다음 각 호의 사유에 해당하는 경우는 사전에 통지 또는 최고 없이 게시 데이터의 삭제, 본 서비스의 이용 제한, 또는 사용자로서의 등록 말소를 행할 수 있는 것으로 합니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>본 약관의 어느 조항을 위반한 경우</li>
          <li>등록 정보에 허위 사실이 있음이 판명된 경우</li>
          <li>일정 기간 이상 본 서비스에 로그인이 없는 경우</li>
          <li>기타 운영자가 본 서비스의 이용을 적절하지 않다고 판단한 경우</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제9조 (콘텐츠 모더레이션)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 게시 데이터가 본 약관 및 운영자가 별도로 정하는 콘텐츠 정책에 적합한지를 확인하기 위해, 자동 심사(AI 기술에 의한 이미지 분석을 포함합니다) 및 인적 심사를 실시하는 경우가 있습니다.
          </li>
          <li>
            심사 결과, 게시 데이터가 콘텐츠 정책을 위반하고 있거나 그 가능성이 있다고 판단된 경우, 운영자는 해당 게시 데이터를 비공개로 하거나 삭제하는 조치를 취할 수 있습니다.
          </li>
          <li>
            콘텐츠 정책을 위반한 사용자에 대해 운영자는 다음 단계적 조치를 취할 수 있습니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>1회째 위반: 경고</li>
              <li>2회째 위반: 일정 기간의 게시 기능 정지</li>
              <li>3회째 이후 위반: 계정의 영구 정지</li>
            </ul>
          </li>
          <li>
            아동의 성적 착취에 관한 콘텐츠(CSAM/IHC)가 검출된 경우, 운영자는 법령에 기초하여 관계 기관으로의 통보를 행하는 것과 더불어, 즉시 계정의 영구 정지 및 기타 필요한 조치를 취합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제10조 (본 서비스의 정지·변경·종료)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 다음 각 호의 사유가 있다고 판단한 경우, 사용자에게 사전에 통지하지 않고 본 서비스의 전부 또는 일부의 제공을 정지 또는 중단할 수 있는 것으로 합니다.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>본 서비스에 관한 컴퓨터 시스템의 보수 점검 또는 갱신을 행하는 경우</li>
              <li>지진, 낙뢰, 화재, 정전 또는 천재 등의 불가항력에 의해 본 서비스의 제공이 곤란해진 경우</li>
              <li>컴퓨터 또는 통신 회선 등이 사고에 의해 정지된 경우</li>
              <li>기타 운영자가 본 서비스의 제공이 곤란하다고 판단한 경우</li>
            </ul>
          </li>
          <li>
            운영자는 본 서비스의 내용을 변경하거나, 또는 본 서비스의 제공을 종료할 수 있는 것으로 합니다. 본 서비스의 제공을 종료하는 경우, 운영자는 사전에 사용자에게 통지하는 것으로 합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제11조 (면책 사항)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 본 서비스에 사실상 또는 법률상의 하자(안전성, 신뢰성, 정확성, 완전성, 유효성, 특정 목적에의 적합성, 보안 등에 관한 결함, 오류나 버그, 권리 침해 등을 포함합니다)가 없다는 것을 명시적으로도 묵시적으로도 보증하지 않습니다.
          </li>
          <li>
            운영자는 본 서비스에 기인하여 사용자에게 발생한 모든 손해에 대해, 운영자의 고의 또는 중과실에 의한 경우를 제외하고는 일체의 책임을 지지 않습니다.
          </li>
          <li>
            운영자는 사용자와 다른 사용자 또는 제3자 간에 발생한 거래, 연락 또는 분쟁 등에 대해 일체 책임을 지지 않습니다.
          </li>
          <li>
            게시 데이터(촬영 스팟 정보를 포함합니다)의 정확성, 신뢰성, 안전성에 대해 운영자는 일체 보증하지 않습니다. 게시된 촬영 스팟 정보에 기초한 행동은 모두 사용자 자신의 책임에 있어서 행하는 것으로 합니다.
          </li>
          <li>
            본 서비스의 이용에 있어서 사용자는 자신의 안전에 충분히 주의하고, 각 지역의 법령이나 규칙을 준수할 책임을 지는 것으로 합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제12조 (약관의 변경)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            운영자는 필요하다고 판단한 경우에는 사용자의 동의를 얻지 않고 본 약관을 변경할 수 있는 것으로 합니다.
          </li>
          <li>
            운영자는 본 약관의 중요한 변경을 행하는 경우는 변경 내용 및 변경의 효력 발생 시기를 사전에 사용자에게 통지하는 것으로 합니다.
          </li>
          <li>
            변경 후의 본 약관은 본 서비스에 게재한 시점부터 효력을 발생시키는 것으로 합니다.
          </li>
          <li>
            사용자가 본 약관 변경 후에도 본 서비스의 이용을 계속한 경우, 해당 사용자는 변경 후의 약관에 동의한 것으로 간주합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제13조 (통지)</h2>
        <p className="text-sm text-gray-700">
          운영자로부터 사용자로의 통지는 등록된 이메일 주소로의 메일 송신 또는 본 서비스에서의 게시, 기타 운영자가 적절하다고 판단하는 방법에 의해 행하는 것으로 합니다. 메일에 의한 통지는 운영자가 메일을 송신한 시점에서 사용자에게 도달한 것으로 간주합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제14조 (권리 의무의 양도 금지)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            사용자는 운영자의 서면에 의한 사전 승낙 없이 본 약관상의 지위 또는 본 약관에 기초한 권리 또는 의무를 제3자에게 양도하거나 담보로 제공할 수 없습니다.
          </li>
          <li>
            운영자는 본 서비스에 관한 사업을 다른 자에게 양도한 경우에는 해당 사업 양도에 따라 본 약관상의 지위, 본 약관에 기초한 권리 및 의무 및 사용자의 등록 정보 및 기타 정보를 해당 사업 양도의 양수인에게 양도할 수 있는 것으로 하며, 사용자는 사전에 이에 동의하는 것으로 합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제15조 (분리 가능성)</h2>
        <p className="text-sm text-gray-700">
          본 약관의 어느 조항 또는 그 일부가 법령 등에 의해 무효 또는 집행 불능으로 판단된 경우라도, 본 약관의 나머지 규정 및 일부가 무효 또는 집행 불능으로 판단된 규정의 나머지 부분은 계속해서 완전히 효력을 가지는 것으로 합니다.
        </p>
      </section>

      <section>
        <h2 className="mb-3">제16조 (준거법·관할 법원)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            본 약관의 해석에 있어서는 일본법을 준거법으로 합니다.
          </li>
          <li>
            본 서비스에 관해 분쟁이 발생한 경우에는 도쿄 지방재판소를 제1심의 전속적 합의 관할 법원으로 합니다.
          </li>
          {/* Issue#105: 국제 이용의 주의사항 */}
          <li>
            본 서비스는 일본에 거점을 둔 사업자에 의해 제공되지만, 전 세계로부터의 액세스를 받아들이고 있습니다. 사용자는 본 서비스의 이용에 있어서 <span className="font-semibold">자국의 법률</span>에 기초하여 본 서비스를 이용하는 것이 가능한지를, 자신의 책임으로 확인하는 것으로 합니다.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">제17조 (외부 서비스의 이용)</h2>
        <p className="text-sm text-gray-700 mb-2">
          본 서비스에서는 다음 외부 서비스를 이용하고 있습니다.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>지도 표시 및 장소 검색에 <a href="https://www.mapbox.com/legal/tos" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Mapbox</a>를 이용하고 있습니다. 지도 데이터는 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">OpenStreetMap</a>이 제공하는 데이터에 기초합니다.</li>
          <li>서비스 개선을 위한 액세스 분석에 <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Analytics 4</a>를 이용하고 있습니다.</li>
          <li>이미지 저장·전송에 Amazon Web Services(AWS)를 이용하고 있습니다.</li>
          <li>오류 모니터링에 <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Sentry</a>를 이용하고 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">제18조 (문의)</h2>
        <p className="text-sm text-gray-700">
          본 약관에 관한 문의는 다음 창구로 연락 주십시오.
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
