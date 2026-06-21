# ===== 画像アップロードバケット（CloudFront E10V のオリジン）=====
# versioning 有効・CORS・lifecycle(glacier移行 + pending削除×3 Issue#100)・ポリシー(EC2/CloudFront)。
# ※ Lambda 通知(moderation/thumbnail トリガー)は Lambda 増分で aws_s3_bucket_notification として追加。

resource "aws_s3_bucket" "uploads_prod" {
  bucket = "photlas-uploads-prod-${data.aws_caller_identity.current.account_id}"

  tags = {
    Project     = "Photlas"
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://photlas.jp"]
    expose_headers  = ["Content-Length"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  rule {
    id     = "move-to-glacier"
    status = "Enabled"

    # AWS は空 Filter({}) を「filter 無し・prefix=null」として保持するため filter ブロックは書かない
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
    transition {
      days          = 180
      storage_class = "GLACIER"
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
resource "aws_s3_bucket_policy" "uploads_prod" {
  bucket = aws_s3_bucket.uploads_prod.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEC2RoleAccess"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/PhotlasEC2Role" }
        Action    = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "${aws_s3_bucket.uploads_prod.arn}/*",
          aws_s3_bucket.uploads_prod.arn,
        ]
      },
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.uploads_prod.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.cdn.arn
          }
        }
      },
    ]
  })
}
