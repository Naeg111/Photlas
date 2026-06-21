# Lambda 実行ロール（3関数が共用：moderation-lambda-role-prod）
# ※ 未使用の photlas-thumbnail-lambda-role-prod は import せず（どの関数にも未使用＝クリーンアップ候補）

resource "aws_iam_role" "lambda_moderation" {
  name        = "photlas-moderation-lambda-role-prod"
  description = "Photlas moderation Lambda execution role (prod)"

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
        Resource = "arn:aws:s3:::photlas-uploads-prod-${local.account_id}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${var.region}:${local.account_id}:parameter/photlas/prod/*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_moderation_basic" {
  role       = aws_iam_role.lambda_moderation.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}
