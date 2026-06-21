# 本番画像 CDN（E10VJ4QJPT0PDV / cdn.photlas.jp）→ S3 photlas-uploads-prod
# シンプルな S3 配信。OAC はフロントと同一。RHP 無し。マネージドポリシーは data source 参照。

resource "aws_cloudfront_distribution" "cdn" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Photlas Image CDN"
  aliases         = ["cdn.photlas.jp"]
  price_class     = "PriceClass_200"
  http_version    = "http2"

  origin {
    origin_id                = "S3-photlas-uploads-prod"
    domain_name              = "photlas-uploads-prod-${data.aws_caller_identity.current.account_id}.s3.${var.region}.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  default_cache_behavior {
    target_origin_id         = "S3-photlas-uploads-prod"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = data.terraform_remote_state.shared.outputs.acm_cloudfront_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
