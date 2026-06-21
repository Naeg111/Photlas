# EC2 インスタンスロール（PhotlasEC2Role）＋インスタンスプロファイル＋カスタム管理ポリシー
# account ID は data source、S3 バケット ARN は構成パターンでハードコード回避（決定 E）。

locals {
  account_id = data.aws_caller_identity.current.account_id
}

resource "aws_iam_role" "ec2" {
  name        = "PhotlasEC2Role"
  description = "Allows EC2 instances to call AWS services on your behalf."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "PhotlasEC2Role"
  role = aws_iam_role.ec2.name
}

# ---- カスタム管理ポリシー ----
resource "aws_iam_policy" "ses" {
  name        = "PhotlasSESPolicy"
  description = "Photlas SES send email policy - minimum permissions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "SESSendEmail"
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
      Condition = {
        StringEquals = { "ses:FromAddress" = "noreply@photlas.jp" }
      }
    }]
  })
}

resource "aws_iam_policy" "s3" {
  name        = "PhotlasS3Policy"
  description = "Photlas S3 access policy - minimum permissions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3UploadsAccess"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:PutObjectTagging", "s3:GetObject", "s3:GetObjectTagging", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::photlas-uploads-prod-${local.account_id}",
          "arn:aws:s3:::photlas-uploads-prod-${local.account_id}/*",
          "arn:aws:s3:::photlas-uploads-test-${local.account_id}",
          "arn:aws:s3:::photlas-uploads-test-${local.account_id}/*",
        ]
      },
      {
        Sid    = "S3FrontendAccess"
        Effect = "Allow"
        Action = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::photlas-frontend-prod-${local.account_id}",
          "arn:aws:s3:::photlas-frontend-prod-${local.account_id}/*",
          "arn:aws:s3:::photlas-frontend-test-${local.account_id}",
          "arn:aws:s3:::photlas-frontend-test-${local.account_id}/*",
        ]
      },
    ]
  })
}

resource "aws_iam_policy" "cloudwatch_logs" {
  name        = "PhotlasCloudWatchLogsPolicy"
  description = "Photlas CloudWatch Logs policy - minimum permissions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "CloudWatchLogsWrite"
      Effect = "Allow"
      Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogGroups", "logs:DescribeLogStreams"]
      Resource = [
        "arn:aws:logs:${var.region}:${local.account_id}:log-group:/photlas/*",
        "arn:aws:logs:${var.region}:${local.account_id}:log-group:/photlas/*:*",
      ]
    }]
  })
}

resource "aws_iam_policy" "ecr_read" {
  name = "PhotlasECRReadPolicy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ecr:GetAuthorizationToken", "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_policy" "rekognition" {
  name        = "PhotlasRekognitionPolicy"
  description = "Issue#119: Photlas backend (EC2) から Rekognition DetectLabels を呼び出すためのポリシー"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "AllowDetectLabels"
      Effect   = "Allow"
      Action   = ["rekognition:DetectLabels"]
      Resource = "*"
    }]
  })
}

# ---- アタッチ ----
resource "aws_iam_role_policy_attachment" "ec2_ses" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ses.arn
}

resource "aws_iam_role_policy_attachment" "ec2_s3" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.s3.arn
}

resource "aws_iam_role_policy_attachment" "ec2_cloudwatch_logs" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.cloudwatch_logs.arn
}

resource "aws_iam_role_policy_attachment" "ec2_ecr_read" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.ecr_read.arn
}

resource "aws_iam_role_policy_attachment" "ec2_rekognition" {
  role       = aws_iam_role.ec2.name
  policy_arn = aws_iam_policy.rekognition.arn
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
