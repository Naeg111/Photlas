terraform {
  required_version = ">= 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # 部分バックエンド設定：bucket / key / region 等の具体値は
  # Git 管理外の backend.hcl に置き、`terraform init -backend-config=backend.hcl` で注入する
  # （決定 E：account ID を含むバケット名を公開リポジトリにコミットしない）。
  backend "s3" {}
}
