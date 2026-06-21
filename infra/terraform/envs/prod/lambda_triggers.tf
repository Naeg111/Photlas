# Lambda トリガー配線（prod）
# S3(uploads/・profile-images/) → SNS(photlas-s3-uploads-prod) → scanner / thumbnail
# EventBridge: monitor=rate(5min) / thumbnail=S3 Object Created(uploads/)
# 各 Lambda の invoke 許可(resource-based policy)

# ===== SNS トピック =====
resource "aws_sns_topic" "s3_uploads" {
  name = "photlas-s3-uploads-prod"
}

resource "aws_sns_topic_policy" "s3_uploads" {
  arn = aws_sns_topic.s3_uploads.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowS3Publish"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = aws_sns_topic.s3_uploads.arn
      Condition = {
        StringEquals = { "aws:SourceAccount" = local.account_id }
        ArnLike      = { "aws:SourceArn" = aws_s3_bucket.uploads_prod.arn }
      }
    }]
  })
}

resource "aws_sns_topic_subscription" "scanner" {
  topic_arn = aws_sns_topic.s3_uploads.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.moderation_scanner.arn

  # lambda サブスクには無関係な属性（import がデフォルトを埋めないため無視）
  lifecycle {
    ignore_changes = [confirmation_timeout_in_minutes, endpoint_auto_confirms]
  }
}

resource "aws_sns_topic_subscription" "thumbnail" {
  topic_arn = aws_sns_topic.s3_uploads.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.thumbnail_generator.arn

  lifecycle {
    ignore_changes = [confirmation_timeout_in_minutes, endpoint_auto_confirms]
  }
}

# ===== S3 通知（uploads-prod → SNS）=====
resource "aws_s3_bucket_notification" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  topic {
    id            = "photlas-uploads-to-sns"
    topic_arn     = aws_sns_topic.s3_uploads.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "uploads/"
  }

  topic {
    id            = "photlas-profile-images-to-sns"
    topic_arn     = aws_sns_topic.s3_uploads.arn
    events        = ["s3:ObjectCreated:*"]
    filter_prefix = "profile-images/"
  }
}

# ===== EventBridge =====
resource "aws_cloudwatch_event_rule" "moderation_monitor" {
  name                = "photlas-moderation-monitor-prod"
  schedule_expression = "rate(5 minutes)"
  state               = "ENABLED"
}

resource "aws_cloudwatch_event_target" "moderation_monitor" {
  rule      = aws_cloudwatch_event_rule.moderation_monitor.name
  target_id = "moderation-monitor"
  arn       = aws_lambda_function.moderation_monitor.arn
}

resource "aws_cloudwatch_event_rule" "thumbnail_s3" {
  name  = "photlas-thumbnail-s3-trigger-prod"
  state = "ENABLED"

  event_pattern = jsonencode({
    source        = ["aws.s3"]
    "detail-type" = ["Object Created"]
    detail = {
      bucket = { name = ["photlas-uploads-prod-${local.account_id}"] }
      object = { key = [{ prefix = "uploads/" }] }
    }
  })
}

resource "aws_cloudwatch_event_target" "thumbnail_s3" {
  rule      = aws_cloudwatch_event_rule.thumbnail_s3.name
  target_id = "thumbnail-lambda"
  arn       = aws_lambda_function.thumbnail_generator.arn

  # S3 EventBridge イベントを、thumbnail Lambda が期待する S3 通知形式に整形
  input_transformer {
    input_paths = {
      bucket = "$.detail.bucket.name"
      key    = "$.detail.object.key"
    }
    input_template = "{\"Records\":[{\"s3\":{\"bucket\":{\"name\":\"<bucket>\"},\"object\":{\"key\":\"<key>\"}}}]}"
  }
}

# ===== Lambda invoke 許可 =====
resource "aws_lambda_permission" "scanner_s3" {
  statement_id  = "s3-trigger-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.moderation_scanner.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads_prod.arn
}

resource "aws_lambda_permission" "scanner_sns" {
  statement_id  = "sns-invoke-photlas-s3-uploads-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.moderation_scanner.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.s3_uploads.arn
}

resource "aws_lambda_permission" "monitor_eventbridge" {
  statement_id  = "eventbridge-trigger-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.moderation_monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.moderation_monitor.arn
}

resource "aws_lambda_permission" "thumbnail_s3" {
  statement_id  = "s3-trigger-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_generator.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads_prod.arn
}

resource "aws_lambda_permission" "thumbnail_eventbridge" {
  statement_id  = "eventbridge-s3-trigger-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_generator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.thumbnail_s3.arn
}

resource "aws_lambda_permission" "thumbnail_sns" {
  statement_id  = "sns-invoke-photlas-s3-uploads-prod"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.thumbnail_generator.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.s3_uploads.arn
}
