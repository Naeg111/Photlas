# VPC フローログ（shared）。VPC の全トラフィックを CloudWatch Logs に記録する。
# 実体は稼働中（fl-0e8f...）。専用 IAM ロール＋ロググループも import して IaC 化する。

resource "aws_iam_role" "vpc_flow_logs" {
  name        = "photlas-vpc-flow-logs-role"
  description = "Role for Photlas VPC Flow Logs"

  # confused-deputy 対策: このアカウント・この VPC のフローログからの引き受けに限定する。
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "vpc-flow-logs.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
        ArnLike = {
          "aws:SourceArn" = "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:vpc-flow-log/*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "photlas-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  # AWS が flow logs ロール用に公式推奨する標準ポリシー（Resource="*"）。これより絞ると
  # 配信が壊れうるため現状維持。引き受け側は上の SourceAccount/SourceArn 条件で固定済み。
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
      ]
      Resource = "*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name = "/aws/vpc/flowlogs/photlas-vpc"
  # retention 無期限（実構成に合わせる）
  retention_in_days = 0
}

resource "aws_flow_log" "main" {
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn             = aws_iam_role.vpc_flow_logs.arn
  max_aggregation_interval = 600

  tags = {
    Name = "photlas-vpc-flow-log"
  }
}
