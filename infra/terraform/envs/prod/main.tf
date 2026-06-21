# prod レイヤー（state②）
# 本番固有: CloudFront(E3RX/E10V) / ALB の host+path ルール+tg-prod / RDS / EC2 /
#           S3 / Lambda(-prod) / WAF / IAM / CloudWatch / 本番 A レコード。
# shared の出力は data.terraform_remote_state.shared.outputs.* で参照する。
# リソースは import で順次追加（TDD: plan no-op）。

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
