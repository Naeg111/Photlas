
resource "aws_cloudwatch_metric_alarm" "prod_status_check_failed" {
  actions_enabled     = true
  alarm_actions       = []
  alarm_description   = "Production server status check failed"
  alarm_name          = "photlas-prod-status-check-failed"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    InstanceId = aws_instance.prod.id
  }
  evaluation_periods        = 2
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "StatusCheckFailed"
  namespace                 = "AWS/EC2"
  ok_actions                = []
  period                    = 60
  region                    = "ap-northeast-1"
  statistic                 = "Maximum"
  tags = {
    Environment = "production"
  }
  threshold           = 1
  threshold_metric_id = null
  treat_missing_data  = "missing"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "app_ratelimit_exceeded" {
  actions_enabled           = true
  alarm_actions             = [aws_sns_topic.waf_alerts.arn]
  alarm_description         = "Issue#95: application-layer rate limit exceeded (>= 10 events / 5 min)"
  alarm_name                = "photlas-app-ratelimit-exceeded"
  comparison_operator       = "GreaterThanOrEqualToThreshold"
  dimensions                = {}
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "AppLayerExceeded"
  namespace                 = "Photlas/RateLimit"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "observability"
    Environment = "production"
    ManagedBy   = "Issue-95"
    Project     = "Photlas"
  }
  threshold           = 10
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_staging_loose_limit" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#94: WAF StagingLooseLimit rule counted requests (staging DoS detection)"
  alarm_name          = "photlas-waf-StagingLooseLimit-CountedRequests"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "StagingLooseLimit"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "staging"
    ManagedBy   = "Issue-94"
    Project     = "Photlas"
  }
  threshold           = 50
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_ip_reputation" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#97: WAF AmazonIpReputationList counted requests (Count mode)"
  alarm_name          = "photlas-waf-IpReputation-Counted"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "AmazonIpReputationList"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-97"
    Project     = "Photlas"
  }
  threshold           = 100
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_common_rule_set" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#97: WAF CommonRuleSet counted requests (Count mode)"
  alarm_name          = "photlas-waf-CommonRuleSet-Counted"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "CommonRuleSet"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-97"
    Project     = "Photlas"
  }
  threshold           = 50
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_auth_rate_limit" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#94: WAF AuthRateLimit rule counted requests (Count mode)"
  alarm_name          = "photlas-waf-AuthRateLimit-CountedRequests"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "AuthRateLimit"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-94"
    Project     = "Photlas"
  }
  threshold           = 5
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_known_bad_inputs" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#97: WAF KnownBadInputsRuleSet counted requests (Count mode)"
  alarm_name          = "photlas-waf-KnownBadInputs-Counted"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "KnownBadInputsRuleSet"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-97"
    Project     = "Photlas"
  }
  threshold           = 20
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_general_rate_limit" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#94: WAF GeneralRateLimit rule counted requests (Count mode)"
  alarm_name          = "photlas-waf-GeneralRateLimit-CountedRequests"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "GeneralRateLimit"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-94"
    Project     = "Photlas"
  }
  threshold           = 20
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "prod_cpu_high" {
  actions_enabled     = true
  alarm_actions       = []
  alarm_description   = "Production server CPU utilization exceeds 80%"
  alarm_name          = "photlas-prod-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  dimensions = {
    InstanceId = aws_instance.prod.id
  }
  evaluation_periods        = 2
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CPUUtilization"
  namespace                 = "AWS/EC2"
  ok_actions                = []
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Average"
  tags = {
    Environment = "production"
  }
  threshold           = 80
  threshold_metric_id = null
  treat_missing_data  = "missing"
  unit                = null
}

resource "aws_cloudwatch_metric_alarm" "waf_sqli" {
  actions_enabled     = true
  alarm_actions       = [aws_sns_topic.waf_alerts.arn]
  alarm_description   = "Issue#97: WAF SQLiRuleSet counted requests (Count mode)"
  alarm_name          = "photlas-waf-SQLi-Counted"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions = {
    Region = "ap-northeast-1"
    Rule   = "SQLiRuleSet"
    WebACL = "photlas-waf-main"
  }
  evaluation_periods        = 1
  extended_statistic        = null
  insufficient_data_actions = []
  metric_name               = "CountedRequests"
  namespace                 = "AWS/WAFV2"
  ok_actions                = [aws_sns_topic.waf_alerts.arn]
  period                    = 300
  region                    = "ap-northeast-1"
  statistic                 = "Sum"
  tags = {
    CostCenter  = "waf"
    Environment = "production"
    ManagedBy   = "Issue-97"
    Project     = "Photlas"
  }
  threshold           = 5
  threshold_metric_id = null
  treat_missing_data  = "notBreaching"
  unit                = null
}
