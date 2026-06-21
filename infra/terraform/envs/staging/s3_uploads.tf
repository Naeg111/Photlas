# ===== 画像アップロードバケット（CloudFront E2QU のオリジン）=====
# versioning 有効・CORS(test+localhost)・lifecycle(delete-test-data + pending削除×3)・ポリシー(EC2/CloudFront)。
# ※ Lambda 通知(moderation/thumbnail トリガー)は Lambda 増分で aws_s3_bucket_notification として追加。

resource "aws_s3_bucket" "uploads_test" {
  bucket = "photlas-uploads-test-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = "Photlas"
    Environment = "test"
  }
}

resource "aws_s3_bucket_versioning" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    # 本番 uploads と違い staging は bucket key 有効
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://test.photlas.jp", "http://localhost:5173", "http://localhost:3000"]
    expose_headers  = ["Content-Length"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  # staging 専用: テストデータを 30 日で削除（旧版は 7 日）。whole-bucket のため filter は書かない。
  rule {
    id     = "delete-test-data"
    status = "Enabled"

    expiration {
      days = 30
    }
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }

  rule {
    id     = "photlas-cleanup-pending-uploads"
    status = "Enabled"

    filter {
      and {
        prefix = "uploads/"
        tags = {
          status = "pending"
        }
      }
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "photlas-cleanup-pending-profile-images"
    status = "Enabled"

    filter {
      and {
        prefix = "profile-images/"
        tags = {
          status = "pending"
        }
      }
    }

    expiration {
      days = 1
    }
  }

  rule {
    id     = "photlas-cleanup-pending-thumbnails"
    status = "Enabled"

    filter {
      and {
        prefix = "thumbnails/"
        tags = {
          status = "pending"
        }
      }
    }

    expiration {
      days = 1
    }
  }
}

# EC2 ロール(読み書き) + CloudFront(OAC, GetObject) を許可
resource "aws_s3_bucket_policy" "uploads_test" {
  bucket = aws_s3_bucket.uploads_test.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEC2RoleAccess"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/PhotlasEC2Role" }
        Action    = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "${aws_s3_bucket.uploads_test.arn}/*",
          aws_s3_bucket.uploads_test.arn,
        ]
      },
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads_test.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn_test.arn
          }
        }
      },
    ]
  })
}
