provider "aws" {
  region = var.region
}

# CloudFront 用 ACM 証明書は us-east-1 のみ有効なため別名プロバイダを用意する
# （shared が us-east-1 の ACM を参照/管理する。Issue#147 §5.8）
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
