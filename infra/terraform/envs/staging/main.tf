# staging レイヤー（state③）
# 生存リソース(ALB test ルール/tg-test/CloudFront/S3/SNS/アラーム等)は import、
# 冬眠で削除済み(EC2/RDS/staging Lambda)はコードのみ・apply は冬眠解除時。
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
}
