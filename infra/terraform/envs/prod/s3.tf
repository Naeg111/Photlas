# 本番 S3 バケット
# バケット名は account_id(data source) から構成（ハードコード回避・決定 E）。

# ===== フロント静的配信バケット（CloudFront E3RX のオリジン）=====
resource "aws_s3_bucket" "frontend_prod" {
  bucket = "photlas-frontend-prod-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = "Photlas"
    Environment = "production"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend_prod" {
  bucket = aws_s3_bucket.frontend_prod.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = false
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_prod" {
  bucket = aws_s3_bucket.frontend_prod.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend_prod" {
  bucket = aws_s3_bucket.frontend_prod.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# CloudFront(OAC) からの GetObject を許可
resource "aws_s3_bucket_policy" "frontend_prod" {
  bucket = aws_s3_bucket.frontend_prod.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontServicePrincipal"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend_prod.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
        }
      }
    }]
  })
}
