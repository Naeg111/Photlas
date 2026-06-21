# staging Lambda 実行ロール
# - moderation 用(scanner/monitor 共用): photlas-moderation-lambda-role-test
# - thumbnail 用(専用): photlas-thumbnail-lambda-role-test
#   ※ prod は thumbnail も moderation ロール共用だが staging は専用ロール（非対称・実機に合わせる）

# ===== moderation ロール（scanner / monitor が共用）=====
resource "aws_iam_role" "lambda_moderation" {
  name        = "photlas-moderation-lambda-role-test"
  description = "Photlas moderation Lambda execution role (test)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_moderation" {
  name = "photlas-moderation-permissions"
  role = aws_iam_role.lambda_moderation.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["rekognition:DetectModerationLabels"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:CopyObject"]
        Resource = "arn:aws:s3:::photlas-uploads-test-${local.account_id}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:${local.account_id}:parameter/photlas/test/*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_moderation_basic" {
  role       = aws_iam_role.lambda_moderation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ===== thumbnail ロール（専用）=====
resource "aws_iam_role" "lambda_thumbnail" {
  name        = "photlas-thumbnail-lambda-role-test"
  description = "Photlas thumbnail generator Lambda execution role (test)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "lambda_thumbnail" {
  name = "photlas-thumbnail-permissions"
  role = aws_iam_role.lambda_thumbnail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:GetObjectTagging", "s3:PutObjectTagging"]
      Resource = "arn:aws:s3:::photlas-uploads-test-${local.account_id}/*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_thumbnail_basic" {
  role       = aws_iam_role.lambda_thumbnail.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
