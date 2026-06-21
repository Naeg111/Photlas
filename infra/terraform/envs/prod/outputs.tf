# 本番の出力（§5.6）。冬眠の destroy/apply で値が変わる項目を Terraform output として公開し、
# 復旧後に `gh secret set` で GitHub Secrets を更新する runbook の起点にする
# （restore.sh の「secret 更新の積み残し」＝旧 instance-id のままデプロイ失敗、を解消）。
#
# GitHub Secrets との対応:
#   production_instance_id                 -> PRODUCTION_INSTANCE_ID
#   production_cloudfront_distribution_id  -> PRODUCTION_CLOUDFRONT_DISTRIBUTION_ID
#   production_cloudfront_domain           -> PRODUCTION_CLOUDFRONT_DOMAIN
#   production_frontend_bucket             -> PRODUCTION_S3_BUCKET

output "production_instance_id" {
  description = "本番 EC2 のインスタンス ID（SSM デプロイ先）"
  value       = aws_instance.prod.id
}

output "production_cloudfront_distribution_id" {
  description = "本番フロント CloudFront(E3RX) のディストリビューション ID（キャッシュ無効化用）"
  value       = aws_cloudfront_distribution.frontend.id
}

output "production_cloudfront_domain" {
  description = "本番フロント CloudFront のドメイン名"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "production_cdn_distribution_id" {
  description = "本番画像 CDN(E10V) のディストリビューション ID"
  value       = aws_cloudfront_distribution.cdn.id
}

output "production_frontend_bucket" {
  description = "本番フロント配信 S3 バケット名（frontend dist 同期先）"
  value       = aws_s3_bucket.frontend_prod.bucket
}

output "production_uploads_bucket" {
  description = "本番アップロード S3 バケット名"
  value       = aws_s3_bucket.uploads_prod.bucket
}
