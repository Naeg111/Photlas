# 監視：SNS アラートトピック（CloudWatch アラームの通知先）
# CloudWatch アラーム本体は cloudwatch_alarms.tf（generate-config-out で生成）。

resource "aws_sns_topic" "waf_alerts" {
  name = "photlas-waf-alerts"

  tags = {
    Project     = "Photlas"
    Environment = "production"
    ManagedBy   = "Issue-94"
    CostCenter  = "waf"
  }
}

resource "aws_sns_topic_subscription" "waf_alerts_email" {
  topic_arn = aws_sns_topic.waf_alerts.arn
  protocol  = "email"
  endpoint  = "support@photlas.jp"

  # import がデフォルトを埋めない属性（無視して no-op に）
  lifecycle {
    ignore_changes = [confirmation_timeout_in_minutes, endpoint_auto_confirms]
  }
}
