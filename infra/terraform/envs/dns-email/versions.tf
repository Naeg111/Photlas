terraform {
  required_version = ">= 1.15.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # 部分バックエンド設定：具体値は Git 管理外の backend.hcl に置く（決定 E）。
  backend "s3" {}
}
