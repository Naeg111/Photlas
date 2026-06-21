# ECR（Docker イメージレジストリ・shared：prod/staging 共通でタグ運用）
# 実構成（aws ecr describe-repositories）:
#   photlas-backend  : MUTABLE / scanOnPush=true  / AES256 / lifecycle=最新10保持
#   photlas-frontend : MUTABLE / scanOnPush=false / AES256 / lifecycle 無し
# リポジトリポリシーは両方とも無し。

resource "aws_ecr_repository" "backend" {
  name                 = "photlas-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "photlas-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# backend のみ：最新10イメージを保持（古いものは expire）
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep only the latest 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
