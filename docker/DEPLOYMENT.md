# Photlas デプロイメントガイド

## 概要

このドキュメントでは、Photlasの自動デプロイメント設定について説明します。

### デプロイフロー

```
develop ブランチ push → テスト環境 (test.photlas.jp)
main ブランチ push    → 本番環境 (photlas.jp)
```

## 必要な GitHub Secrets

GitHub リポジトリの Settings → Secrets and variables → Actions で以下のシークレットを設定してください。

### AWS認証情報

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `AWS_ACCOUNT_ID` | AWSアカウントID | `123456789012` |
| `AWS_ACCESS_KEY_ID` | IAMアクセスキーID | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAMシークレットアクセスキー | `wJalrXUtnFEMI/K7MDENG/...` |

### EC2接続情報

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `STAGING_EC2_HOST` | テスト環境EC2のIPアドレス/ホスト名 | `ec2-xx-xx-xx-xx.ap-northeast-1.compute.amazonaws.com` |
| `PRODUCTION_EC2_HOST` | 本番環境EC2のIPアドレス/ホスト名 | `ec2-yy-yy-yy-yy.ap-northeast-1.compute.amazonaws.com` |
| `EC2_USER` | EC2接続ユーザー名 | `ec2-user` |
| `EC2_SSH_KEY` | EC2接続用SSHプライベートキー | `-----BEGIN RSA PRIVATE KEY-----...` |

### データベース接続情報（テスト環境）

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `STAGING_DATABASE_URL` | テスト環境DB接続URL | `jdbc:postgresql://xxx.rds.amazonaws.com:5432/photlas_staging` |
| `STAGING_DATABASE_USER` | テスト環境DBユーザー名 | `photlas_staging` |
| `STAGING_DATABASE_PASSWORD` | テスト環境DBパスワード | `your-secure-password` |
| `STAGING_S3_BUCKET` | テスト環境S3バケット名 | `photlas-staging-images` |

### データベース接続情報（本番環境）

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `PRODUCTION_DATABASE_URL` | 本番環境DB接続URL | `jdbc:postgresql://xxx.rds.amazonaws.com:5432/photlas_prod` |
| `PRODUCTION_DATABASE_USER` | 本番環境DBユーザー名 | `photlas_prod` |
| `PRODUCTION_DATABASE_PASSWORD` | 本番環境DBパスワード | `your-secure-password` |
| `PRODUCTION_S3_BUCKET` | 本番環境S3バケット名 | `photlas-prod-images` |

### アプリケーション設定

| シークレット名 | 説明 | 例 |
|--------------|------|-----|
| `JWT_SECRET` | JWT署名用シークレットキー | `your-very-long-secret-key-here` |
| `VITE_GOOGLE_MAPS_API_KEY` | フロントエンド用Google Maps APIキー | `AIzaSy...` |

## EC2 インスタンスの事前準備

各EC2インスタンスで以下の準備が必要です：

### 1. 必要なソフトウェアのインストール

```bash
# Amazon Linux 2023の場合
sudo dnf update -y
sudo dnf install -y docker git

# Dockerサービスの起動と有効化
sudo systemctl start docker
sudo systemctl enable docker

# ユーザーをdockerグループに追加
sudo usermod -aG docker $USER

# Docker Composeのインストール
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# AWS CLIの設定
aws configure
```

### 2. デプロイディレクトリの作成

```bash
mkdir -p ~/photlas/docker/nginx
cd ~/photlas
git clone https://github.com/your-org/Photlas.git .
```

### 3. SSL証明書の取得（Let's Encrypt）

```bash
# Certbotのインストール
sudo dnf install -y certbot

# テスト環境
sudo certbot certonly --standalone -d test.photlas.jp

# 本番環境
sudo certbot certonly --standalone -d photlas.jp -d www.photlas.jp
```

## AWS リソースの事前準備

### 1. ECRリポジトリの作成

```bash
# フロントエンド用リポジトリ
aws ecr create-repository --repository-name photlas-frontend --region ap-northeast-1

# バックエンド用リポジトリ
aws ecr create-repository --repository-name photlas-backend --region ap-northeast-1
```

### 2. IAMポリシーの作成

デプロイ用IAMユーザーに以下のポリシーをアタッチしてください：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:GetRepositoryPolicy",
        "ecr:DescribeRepositories",
        "ecr:ListImages",
        "ecr:DescribeImages",
        "ecr:BatchGetImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage"
      ],
      "Resource": "*"
    }
  ]
}
```

### 3. セキュリティグループの設定

EC2インスタンスのセキュリティグループで以下のインバウンドルールを許可：

| ポート | プロトコル | ソース | 用途 |
|-------|----------|--------|------|
| 22 | TCP | GitHub Actions IP範囲 | SSH接続 |
| 80 | TCP | 0.0.0.0/0 | HTTP |
| 443 | TCP | 0.0.0.0/0 | HTTPS |

## トラブルシューティング

### デプロイが失敗する場合

1. GitHub Actionsのログを確認
2. EC2にSSHして手動でコマンドを実行
3. `docker compose logs` でコンテナログを確認

### コンテナが起動しない場合

```bash
# コンテナのステータス確認
docker compose -f docker/docker-compose.staging.yml ps

# ログの確認
docker compose -f docker/docker-compose.staging.yml logs -f

# コンテナの再起動
docker compose -f docker/docker-compose.staging.yml restart
```

### ヘルスチェックが失敗する場合

1. バックエンドAPIの `/api/v1/health` エンドポイントを直接確認
2. データベース接続を確認
3. 環境変数が正しく設定されているか確認
