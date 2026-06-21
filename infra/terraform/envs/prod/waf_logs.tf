# WAF ログ基盤：WebACL → Firehose(aws-waf-logs-photlas) → S3(waf-logs) ＋ firehose ロール
# ＋ WebACL の ALB 関連付け・ログ設定（authorization ヘッダをリダクション）

# ===== firehose ロール =====
resource "aws_iam_role" "waf_firehose" {
  name        = "photlas-waf-firehose-role"
  description = "Firehose role for AWS WAF logs delivery to S3 (Issue#94)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "firehose.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Project     = "Photlas"
    Environment = "production"
    ManagedBy   = "Issue-94"
    CostCenter  = "waf"
  }
}

resource "aws_iam_role_policy" "waf_firehose_s3" {
  name = "photlas-waf-firehose-s3-access"
  role = aws_iam_role.waf_firehose.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:AbortMultipartUpload",
        "s3:GetBucketLocation",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:ListBucketMultipartUploads",
        "s3:PutObject",
      ]
      Resource = [
        aws_s3_bucket.waf_logs.arn,
        "${aws_s3_bucket.waf_logs.arn}/*",
      ]
    }]
  })
}

# ===== waf-logs S3 バケット =====
resource "aws_s3_bucket" "waf_logs" {
  bucket = "photlas-waf-logs-${local.account_id}"

  tags = {
    Project     = "Photlas"
    Environment = "production"
    ManagedBy   = "Issue-94"
    CostCenter  = "waf"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "waf_logs" {
  bucket = aws_s3_bucket.waf_logs.id

  rule {
    id     = "delete-old-waf-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 90
    }
  }
}

# ===== Firehose =====
resource "aws_kinesis_firehose_delivery_stream" "waf_logs" {
  name        = "aws-waf-logs-photlas"
  destination = "extended_s3"

  extended_s3_configuration {
    role_arn            = aws_iam_role.waf_firehose.arn
    bucket_arn          = aws_s3_bucket.waf_logs.arn
    prefix              = "waf-logs/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/"
    error_output_prefix = "waf-logs-errors/"
    buffering_size      = 5
    buffering_interval  = 300
    compression_format  = "GZIP"
  }

  tags = {
    Project     = "Photlas"
    Environment = "production"
    ManagedBy   = "Issue-94"
    CostCenter  = "waf"
  }
}

# ===== WebACL 関連付け・ログ設定 =====
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = data.terraform_remote_state.shared.outputs.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  resource_arn            = aws_wafv2_web_acl.main.arn
  log_destination_configs = [aws_kinesis_firehose_delivery_stream.waf_logs.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }
}
