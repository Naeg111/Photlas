# shared レイヤー（state①）
# prod / staging が共有する土台：VPC・サブネット・RT・IGW・NAT・SG・ALB(本体)・ACM・ECR、
# および Route53 ゾーン（data source 参照）。リソースは import で順次追加していく（TDD：plan no-op）。

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}
