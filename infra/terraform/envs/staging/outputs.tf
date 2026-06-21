# staging の出力（§5.6）。冬眠解除時に apply してから `terraform output` で値を取得し、
# GitHub Secrets を更新する。staging_instance_id は EC2 がコードのみ（未 apply）のため
# apply 前は known after apply。
#
# GitHub Secrets との対応:
#   staging_instance_id                 -> STAGING_INSTANCE_ID
#   staging_cloudfront_distribution_id  -> STAGING_CLOUDFRONT_DISTRIBUTION_ID
#   staging_cloudfront_domain           -> STAGING_CLOUDFRONT_DOMAIN
#   staging_frontend_bucket             -> STAGING_S3_BUCKET

output "staging_instance_id" {
  description = "staging EC2 のインスタンス ID（冬眠解除 apply 後に確定）"
  value       = aws_instance.test.id
}

output "staging_cloudfront_distribution_id" {
  description = "staging フロント CloudFront(E33U) のディストリビューション ID"
  value       = aws_cloudfront_distribution.frontend_test.id
}

output "staging_cloudfront_domain" {
  description = "staging フロント CloudFront のドメイン名"
  value       = aws_cloudfront_distribution.frontend_test.domain_name
}

output "staging_cdn_distribution_id" {
  description = "staging 画像 CDN(E2QU) のディストリビューション ID"
  value       = aws_cloudfront_distribution.cdn_test.id
}

output "staging_frontend_bucket" {
  description = "staging フロント配信 S3 バケット名"
  value       = aws_s3_bucket.frontend_test.bucket
}

output "staging_uploads_bucket" {
  description = "staging アップロード S3 バケット名"
  value       = aws_s3_bucket.uploads_test.bucket
}
