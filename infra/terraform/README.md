# Photlas インフラ（Terraform）

Issue#147「インフラ構成の全面 IaC 化」の実装。AWS の全インフラを Terraform で単一正本化する。

## 方針（Issue#147 決定事項のサマリ）

- **import 先行**：稼働中の本番リソースを `terraform import` で取り込み、`terraform plan` が **No changes（差分ゼロ）** になることで「コード＝実構成」を検証する。import 自体はリソースを変更しないため本番無害・コスト0。
- **state は4分割**：`shared`（VPC/NAT/ALB本体/ACM/ECR・prod/staging 共通）／`prod`／`staging`／`dns-email`（メール系 DNS の隔離）。
- **公開リポジトリ対応（決定 E）**：`*.tf` の汎用コードはコミット。具体値（`*.tfvars`）・`*.tfstate`・`backend.hcl`・`.terraform/` は `.gitignore`。モジュールに account ID/ARN をハードコードしない。
- **apply はハイブリッド（決定 F）**：PR で `plan` を可視化、`apply` は手動/承認ゲート。本番自動 apply はしない。
- **冬眠（決定 D）**：コスト削減の「畳む/戻す」は `terraform destroy/apply` で再現（RDS は final snapshot＋snapshot 復元、EC2 は CI 再デプロイ）。

詳細は `documents/04_Issues/Issue#147.md`。

## ディレクトリ

```
infra/terraform/
└── envs/
    ├── shared/     # 【state①】VPC/NAT/ALB本体/ACM/ECR/VPCフローログ/GitHub OIDC ＋ Route53 ゾーン参照
    ├── prod/       # 【state②】本番（import 先行・plan no-op）
    ├── staging/    # 【state③】ステージング（生存リソースは import・EC2/RDS はコードのみ）
    └── dns-email/  # 【state④】メール系 DNS（冬眠 destroy 経路に含めない・prevent_destroy）
```

> **モジュールは未使用**：当初案（§5.1）の `modules/` は作らず、各 env 直下にフラットな `.tf` を
> 置く構成にした。import 先行＋env ごとの実構成差（prod/staging で OAC・ロール・lifecycle 等が
> 非対称）が大きく、モジュール抽象より「実機に1:1で対応する素直な HCL」の方が import と
> plan no-op 検証がしやすいと判断したため。共有リソースは remote state / data source で参照する。

## 使い方（各 env ディレクトリで実行）

state バケットは Terraform の外で bootstrap 済み（`photlas-terraform-state-<ACCOUNT_ID>`、ap-northeast-1、versioning＋SSE＋native lock）。
バックエンドの具体値は `backend.hcl`（Git 管理外）に置き、partial backend config で init する。

```bash
# 初期化（バックエンドの具体値は backend.hcl から）
terraform init -backend-config=backend.hcl

# テスト＝差分ゼロの確認（import 後にこれが No changes になれば正本化 OK）
terraform validate
terraform plan
```

## import の進め方（TDD：plan no-op をテストとする）

1. 対象リソースの `.tf` を実構成に合わせて記述（`scripts/hibernate/state/*.json` を参照ソースに）
2. `terraform import <addr> <id>` で state に取り込む（**リソース未変更**）
3. `terraform plan` が **No changes** になるまで `.tf` を修正（= テストが green）
4. 小さく1リソースずつ。差分が出たら実構成に合わせる

> import/plan/バケット作成など AWS に触れる操作は、本リポジトリの運用ルール（Issue#147）に従い段階承認で実行する。

## CI（GitHub Actions・決定 F）

`.github/workflows/terraform.yml` が PR で `fmt-check` / `validate` / `plan` を 4 env 分実行し、
plan を PR にコメントする。`apply` は CI では行わず**手元（ローカル）**で実行する。

- AWS 認証は **OIDC**（長期キー不使用）。CI の plan は読み取り専用ロール **PhotlasTerraformPlanRole**
  （`ReadOnlyAccess` のみ）を引き受ける。書き込み権限を持つデプロイロール **PhotlasGitHubActionsRole**
  とは**別ロール・別信頼**（デプロイは main/develop プッシュのみ・PR からは引き受け不可）。
- plan は `-lock=false` で state を書かない。
- 必要な GitHub 設定はワークフロー冒頭コメント参照（`AWS_ACCOUNT_ID` / `*_MODERATION_API_KEY` /
  `STAGING_SHARED_S3_OAC_ID`）。

## 冬眠（コスト削減の畳む/戻す・決定 D / §5.3）

「畳む/戻す」は手続きスクリプト（旧 `scripts/hibernate/`）ではなく Terraform で行う。

**畳む（fold）:**
- **staging だけ畳む**＝ staging state を `terraform -chdir=envs/staging destroy`
  （共有 ALB・VPC・Route53・本番は無傷。decision H の blast radius 分離）。
  ※ RDS は `prevent_destroy`/`deletion_protection` を一時的に外す必要あり。destroy 時に
  `final_snapshot_identifier` のスナップショットが自動取得される。
- **本番も畳む**＝ prod state も同様に destroy（RDS は final snapshot）。
- **共有 NAT（≈¥8,160/月）を畳む**＝ shared の `aws_nat_gateway`/`aws_eip.nat` と private RT の
  NAT ルートを落とす。※ 現状は env-destroy 方式で実装済み（§6.8 の OR 条件を満たす）。NAT 単体を
  VPC を残したまま畳む `nat_enabled` トグル（count=0）は、本番ネットワーク state への影響を避けるため
  **実際に冬眠する時に count 化＋state mv で導入**する（未実装・runbook のみ）。

**戻す（unfold）= `terraform apply`:**
1. `terraform apply` で RDS（**冬眠スナップショットから復元**＝データ保持）・EC2・NAT 等を再作成。
   - staging の初回復元は `snapshot_identifier = photlas-db-staging-hibernate-...` から（空 DB を作らない）。
   - EC2 は素のインスタンスを作り、アプリは CI（`deploy.yml`）の SSM 再デプロイで復元。
2. **secrets を同期**（§5.6・下記）。
3. CloudFront の ALB オリジン・A レコードは apply で live な共有 ALB を指すよう自己修復する
   （冬眠で ALB が再作成され DNS が変わってもドリフトしない）。

> ⚠ **prod を畳む前に必ず staging で `apply→destroy→apply→データ保持` を実証する**
> （本番 RDS をぶっつけ本番で畳まない・§5.3）。

## 復旧後の secrets 同期（§5.6）

冬眠の destroy/apply で **instance ID・CloudFront dist ID・bucket 名**が変わるため、
`deploy.yml` が参照する GitHub Secrets を更新する。Terraform output から取得する:

```bash
cd infra/terraform/envs/prod   # または staging
terraform output   # production_instance_id / production_cloudfront_distribution_id / ...

# 例（gh CLI で Secrets 更新）
gh secret set PRODUCTION_INSTANCE_ID -b "$(terraform output -raw production_instance_id)"
gh secret set PRODUCTION_CLOUDFRONT_DISTRIBUTION_ID -b "$(terraform output -raw production_cloudfront_distribution_id)"
gh secret set PRODUCTION_S3_BUCKET -b "$(terraform output -raw production_frontend_bucket)"
# staging も staging_* を同様に
```

これで restore.sh の「secret 更新の積み残し（旧 instance-id のままデプロイが `InvalidInstanceId` で失敗）」を解消する。
