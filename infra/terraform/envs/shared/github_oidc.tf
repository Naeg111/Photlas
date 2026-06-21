# GitHub Actions OIDC（CI 認証基盤・決定 F / §5.5）
#
# 権限昇格を防ぐため、書き込み(デプロイ)と読み取り(plan)を別ロールに分離する:
#   - PhotlasGitHubActionsRole … デプロイ用(S3 書込/ECR push/SSM)。信頼は main/develop の
#       プッシュのみ（PR からは引き受け不可）。deploy.yml が将来 OIDC 化する際に使用。
#   - PhotlasTerraformPlanRole … Terraform CI(plan)用。ReadOnlyAccess のみ。PR からも
#       引き受け可だが読み取りしかできない。terraform.yml はこちらを使う。
# こうすることで「PR トリガーのワークフローが書き込み権限を得る」経路を塞ぐ。
# apply は手元（ローカル）で実行する方針。

# ===== OIDC プロバイダ（GitHub Actions）=====
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

# ===== デプロイ用ロール（書き込み）。信頼を main/develop プッシュに限定（PR は不可）=====
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
        # デプロイは main(本番)・develop(staging) プッシュのみ。PR(pull_request)からは引き受けられない。
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:Naeg111/Photlas:ref:refs/heads/main",
            "repo:Naeg111/Photlas:ref:refs/heads/develop",
          ]
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

# ===== Terraform CI（plan）用ロール：ReadOnlyAccess のみ・PR からも引き受け可 =====
# plan は全リソース種別の読み取り＋state バケット(S3)の読み取りが要るが、書き込みは一切不要
# （CI の plan は `-lock=false` で状態を書かない）。デプロイ権限と切り離すことで、PR トリガーの
# ワークフローが万一悪用されても読み取り以上はできない。
resource "aws_iam_role" "terraform_plan" {
  name                 = "PhotlasTerraformPlanRole"
  description          = "Read-only role for Terraform plan in GitHub Actions CI"
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
        # PR(plan 表示)・ブランチからの workflow_dispatch を許可。読み取り専用なので広めでも害が小さい。
        StringLike = {
          "token.actions.githubusercontent.com:sub" = [
            "repo:Naeg111/Photlas:pull_request",
            "repo:Naeg111/Photlas:ref:refs/heads/*",
          ]
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "terraform_plan_readonly" {
  role       = aws_iam_role.terraform_plan.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
