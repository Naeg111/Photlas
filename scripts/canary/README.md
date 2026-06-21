# SEO 死活監視 canary（Issue#148）

本番 `https://photlas.jp` の SEO 重要 URL を **30 分おき**に外形監視する CloudWatch Synthetics canary。
「CloudFront 経路漏れで S3 の SPA 殻が無言で返る」「`X-Robots-Tag: noindex` 誤付与」等、
**デプロイとは無関係に発生する配信障害**を継続検知する（デプロイ時スモークテストは別途 `deploy.yml`）。

- 設計の真実: `documents/04_Issues/Issue#148.md`
- 受け入れ基準: 同 §6.1

## 構成

| ファイル | 役割 | テスト |
|---|---|---|
| `checks.mjs` | 検証ロジック（純粋関数） | `__tests__/checks.test.js`（`node --test`、CI 対象） |
| `seo-canary.js` | Synthetics handler（HTTP 取得＋ランタイム連携の薄いラッパー） | ランタイム依存のため単体テスト対象外 |
| `../setup-synthetics-canary.sh` | デプロイ（冪等。canary / IAM / S3 / アラーム） | `tests/scripts/setup-synthetics-canary.bats` |

## 監視内容（各実行でチェック）

`/tags/{slug}?lang=ja`（GET・リダイレクト非追従）:
- HTTP 200 / `hreflang=` が 5 以上 / `canonical` が `https://photlas.jp/` 絶対 URL / `X-Robots-Tag: noindex` が無い

`/photo-viewer/{id}`（GET）:
- HTTP 200 / `og:url` が `https://photlas.jp/photo-viewer/{id}` / `og:image` が CDN サムネ（`og-image.png` でない）/ `X-Robots-Tag: noindex` が無い

監視対象の slug/id は `sitemap-tags.xml` / `sitemap-photos-0.xml` から実行時に動的取得する。
**ハイブリッド挙動**: sitemap が壊れている（5xx・XML でなく HTML 等）なら失敗、正常だが 0 件（公開写真ゼロ等）ならその URL はスキップ（コールドスタート期の誤報防止）。

## デプロイ

```bash
# 前提: SNS topic photlas-waf-alerts（本番アラート集約先、setup-waf-alarms.sh で作成）が存在し、
#       メール購読が confirmed であること（未確認だとアラートが届かない）。
./scripts/setup-synthetics-canary.sh
```

冪等。再実行すると canary は update、アラームは上書きされる。

## アラート発報時の triage runbook

アラーム `photlas-seo-canary-SuccessPercent` は **2 回連続失敗**で発報する（一過性の瞬断は無視）。
発報したら、まず CloudWatch Synthetics コンソールで **失敗実行のログ／スクショ**を見て、どの URL の
どの条件で落ちたかを特定し、以下を順に確認する。

1. **CloudFront ビヘイビア** — `/tags/*`・`/photo-viewer/*` が backend オリジン（ALB）に向くビヘイビアが
   消えていないか／別オリジン（S3）に吸われていないか。今回の発生元事故がこれ。
2. **ALB リスナールール** — 上記パスを backend ターゲットグループへ振り分けるルールの誤削除・優先度変更。
3. **backend** — フィルタ変更による `X-Robots-Tag: noindex` 誤付与（`XRobotsTagFilter`）、SSR の退化。
   `curl -sI https://photlas.jp/tags/<slug>?lang=ja` でヘッダを直接確認。
4. **証明書 / ドメイン / オリジン到達性** — 証明書失効、DNS、オリジンの 5xx 等。

> 補足: sitemap が壊れているとの失敗（`sitemap delivery broken`）なら、まず backend（`/api/v1/sitemap-*.xml`）の
> 配信そのものを疑う。`hreflang count 0` や `og:url is https://photlas.jp/` は **S3 殻が返っている**典型サイン。

## 発報の動作確認（受け入れ基準 E-4）

意図的に条件を満たさない状態を作り、アラートが飛ぶことを一度確認する。例:
- 監視対象 slug を一時的に存在しない値へ差し替えてデプロイ → 2 連続失敗で発報 → 復旧で OK 通知、を確認。
- 確認後は必ず元に戻す。

## コスト

CloudWatch Synthetics は実行回数課金。1 canary・30 分間隔で月 ~1,440 実行、**月数百円程度**の想定。
頻度を上げる場合は `setup-synthetics-canary.sh` の `SCHEDULE_EXPRESSION` を変更する。
