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
├── modules/        # 再利用するリソース定義（順次追加）
└── envs/
    ├── shared/     # 【state①】VPC/NAT/ALB本体/ACM/ECR ＋ Route53 ゾーン参照
    ├── prod/       # 【state②】本番（import 先行）
    ├── staging/    # 【state③】ステージング（コードのみ・apply は冬眠解除時）
    └── dns-email/  # 【state④】メール系 DNS（冬眠 destroy 経路に含めない・prevent_destroy）
```

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
