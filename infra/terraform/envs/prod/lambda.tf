# 本番 Lambda 3関数（決定 G 改訂：infra のみ TF 管理・コードは ignore_changes）
# コードは scripts/deploy-lambda.sh でデプロイ（稼働中の依存込みパッケージを温存）。
# filename はプレースホルダ（ignore_changes で無視）。env の機密は変数。

resource "aws_lambda_function" "moderation_scanner" {
  function_name = "photlas-moderation-scanner-prod"
  role          = aws_iam_role.lambda_moderation.arn
  runtime       = "python3.12"
  handler       = "lambda_function.lambda_handler"
  architectures = ["x86_64"]
  memory_size   = 256
  timeout       = 30
  filename      = "${path.module}/lambda_placeholder.zip"

  environment {
    variables = {
      BACKEND_API_URL    = "https://api.photlas.jp"
      MODERATION_API_KEY = var.moderation_api_key
      SLACK_WEBHOOK_URL  = ""
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "moderation_monitor" {
  function_name = "photlas-moderation-monitor-prod"
  role          = aws_iam_role.lambda_moderation.arn
  runtime       = "python3.12"
  handler       = "lambda_function.lambda_handler"
  architectures = ["x86_64"]
  memory_size   = 128
  timeout       = 30
  filename      = "${path.module}/lambda_placeholder.zip"

  environment {
    variables = {
      STALE_THRESHOLD_MINUTES = "5"
      BACKEND_API_URL         = "https://api.photlas.jp"
      MODERATION_API_KEY      = var.moderation_api_key
      SLACK_WEBHOOK_URL       = ""
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_function" "thumbnail_generator" {
  function_name = "photlas-thumbnail-generator-prod"
  role          = aws_iam_role.lambda_moderation.arn
  runtime       = "python3.12"
  handler       = "lambda_function.lambda_handler"
  architectures = ["x86_64"]
  memory_size   = 512
  timeout       = 60
  filename      = "${path.module}/lambda_placeholder.zip"

  environment {
    variables = {
      BACKEND_URL        = "https://photlas.jp"
      MODERATION_API_KEY = var.moderation_api_key
    }
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}
