# staging EC2 監視アラーム（CPU 高負荷・ステータスチェック失敗）
# ※ 現状は冬眠前の死んだ instance-id を監視していたため、コードは aws_instance.test.id を参照する。
#   EC2 はコードのみ（未 apply）なので import 後の plan では dimension が「known after apply」に
#   変わる差分が出る。冬眠解除時に EC2 を apply すれば新インスタンスを正しく監視する（自己修復）。
# 通知アクションは現状なし（実機に合わせ alarm_actions は空）。

resource "aws_cloudwatch_metric_alarm" "test_cpu_high" {
  alarm_name          = "photlas-test-cpu-high"
  alarm_description   = "Test server CPU utilization exceeds 80%"
  comparison_operator = "GreaterThanThreshold"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  treat_missing_data  = "missing"
  actions_enabled     = true
  alarm_actions       = []
  ok_actions          = []

  dimensions = {
    InstanceId = aws_instance.test.id
  }

  tags = {
    Environment = "test"
  }
}

resource "aws_cloudwatch_metric_alarm" "test_status_check_failed" {
  alarm_name          = "photlas-test-status-check-failed"
  alarm_description   = "Test server status check failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  treat_missing_data  = "missing"
  actions_enabled     = true
  alarm_actions       = []
  ok_actions          = []

  dimensions = {
    InstanceId = aws_instance.test.id
  }

  tags = {
    Environment = "test"
  }
}
