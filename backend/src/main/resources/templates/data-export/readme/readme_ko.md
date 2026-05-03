# Photlas 내보내기 데이터

사용자: {{username}}
내보낸 시각: {{exportedAt}}

이 아카이브에는 Photlas가 보관하고 있는 회원님의 데이터가 포함되어 있습니다.
GDPR(EU 일반 데이터 보호 규정) 제20조의 데이터 이동권 행사 결과로 제공됩니다.

## 파일 구성

| 파일 / 디렉터리              | 내용 |
|------------------------------|------|
| `README.md`                  | 본 파일(아카이브 구성과 필드 설명) |
| `user.json`                  | 프로필 정보(표시 이름·이메일·언어 등) |
| `profile_image.*`            | 프로필 이미지(설정되어 있는 경우) |
| `photos.json`                | 게시한 사진의 메타데이터 |
| `photos/`                    | 원본 사진 파일(`{photoId}.{확장자}`) |
| `favorites.json`             | 즐겨찾기 목록 |
| `sns_links.json`             | 프로필 SNS 링크 |
| `oauth.json`                 | OAuth 연동(Google / LINE 등) |
| `reports.json`               | 회원님이 제출한 신고 이력 |
| `sanctions.json`             | 계정 제재 이력(관리자 자유 기술은 제외) |
| `violations.json`            | 위반 이력(관리자 자유 기술은 제외) |
| `location_suggestions.json`  | 회원님이 제출한 위치 정보 수정 제안 |
| `spots.json`                 | 회원님이 만든 촬영 스팟 |
| `errors.json`                | 이미지 다운로드 실패 등 오류(없으면 빈 배열) |
| `_complete.flag`             | 아카이브 완전성 표시(이 파일이 있으면 정상 완료) |

## 주요 필드 설명

### `photos.json`의 `moderationStatus`
- `1001` = PENDING_REVIEW(검토 대기)
- `1002` = PUBLISHED(공개)
- `1003` = QUARANTINED(격리)
- `1004` = REMOVED(삭제됨) — 이미지 파일은 포함되지 않습니다

### 날짜 형식
- 모든 JSON 파일의 시각은 **UTC** ISO 8601 형식(끝에 `Z`, 예: `2026-03-10T05:30:00Z`) 입니다.
- 본 파일과 알림 메일의 시각만 회원님의 언어 설정에 따른 현지 시간으로 표시됩니다.

## 중요 안내

- 본 아카이브에는 개인 정보(이메일, 촬영 위치, 기기 정보 등)가 포함되어 있습니다. 제3자와 공유할 때는 주의하세요.
- `_complete.flag`이 아카이브에 없으면 다운로드 도중에 중단되었을 수 있으니 다시 요청해 주세요.
- REMOVED 상태의 사진은 메타데이터만 포함되며 이미지 자체는 재배포되지 않습니다.
- 추가 문의나 정보 공개 요청은 support@photlas.jp로 연락해 주세요.
