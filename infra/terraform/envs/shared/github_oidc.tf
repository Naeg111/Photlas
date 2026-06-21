# GitHub Actions OIDC（CI 認証基盤・決定 F / §5.5）
# 既存リソース（OIDC プロバイダ・PhotlasGitHubActionsRole・デプロイ用ポリシー）を import。
# Terraform CI（terraform.yml）の plan 用に AWS マネージド ReadOnlyAccess を追加付与する。
# apply は手元（ローカル）で実行する方針のため、このロールに広い書き込み権限は与えない。

# ===== OIDC プロバイダ（GitHub Actions）=====
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

# ===== CI/CD 用ロール（信頼: repo:Naeg111/Photlas の OIDC トークン）=====
resource "aws_iam_role" "github_actions" {
  name                 = "PhotlasGitHubActionsRole"
  description          = "Role for GitHub Actions CI/CD for Photlas"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:Naeg111/Photlas:*"
        }
      }
    }]
  })
}

# ===== デプロイ用ポリシー（deploy.yml が使用）=====
resource "aws_iam_policy" "github_actions_deploy" {
  name        = "PhotlasGitHubActionsDeployPolicy"
  description = "Policy for GitHub Actions CI/CD deployment"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3FrontendDeploy"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::photlas-frontend-prod-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::photlas-frontend-prod-${data.aws_caller_identity.current.account_id}/*",
          "arn:aws:s3:::photlas-frontend-test-${data.aws_caller_identity.current.account_id}",
          "arn:aws:s3:::photlas-frontend-test-${data.aws_caller_identity.current.account_id}/*",
        ]
      },
      {
        Sid    = "CloudFrontInvalidation"
        Effect = "Allow"
        Action = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation", "cloudfront:ListInvalidations"]
        Resource = [
          "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/E3RXKAXCTDAFOI",
          "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/E33UFH77Q11V2Q",
        ]
      },
      {
        Sid      = "ECRAccess"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "ECRRepositoryAccess"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage",
          "ecr:PutImage", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload",
        ]
        Resource = "arn:aws:ecr:${var.region}:${data.aws_caller_identity.current.account_id}:repository/photlas-*"
      },
      {
        Sid    = "SSMParameterAccess"
        Effect = "Allow"
        Action = ["ssm:SendCommand", "ssm:GetCommandInvocation"]
        Resource = [
          "arn:aws:ssm:${var.region}::document/AWS-RunShellScript",
          "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/*",
        ]
        Condition = {
          StringEquals = {
            "ssm:resourceTag/Project" = "Photlas"
          }
        }
      },
      {
        Sid      = "EC2DescribeForDeploy"
        Effect   = "Allow"
        Action   = ["ec2:DescribeInstances", "ec2:DescribeTags"]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_deploy" {
  role       = aws_iam_role.github_actions.name
  policy_arn = aws_iam_policy.github_actions_deploy.arn
}

# ===== Terraform CI（plan）用：AWS マネージド ReadOnlyAccess を付与 =====
# plan は全リソース種別の読み取り＋state バケット(S3)の読み取りが要るため。
# CI の plan は `-lock=false`（状態を書かない）で実行するので書き込み権限は不要。
resource "aws_iam_role_policy_attachment" "github_actions_readonly" {
  role       = aws_iam_role.github_actions.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
