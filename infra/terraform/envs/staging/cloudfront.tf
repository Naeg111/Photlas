# staging CloudFront（E33UFH77Q11V2Q=frontend / E2QUQ7UASG8U7W=test-cdn）
#
# - 共有ポリシー(OAC photlas-s3-oac / cache photlas-tags-ssr / RHP photlas-security-headers)は
#   prod state が所有するが account グローバル → staging からは data source で参照する。
# - メンテ用 Function(photlas-frontend-fn-test)は全ビヘイビアに常時関連付け。コードは
#   maintenance.js ⇔ passthrough.js を運用トグル(maintenance-on/off.sh)で差し替えるため
#   ignore_changes で TF 管理外にする（Lambda コードと同じ決定 G の考え方）。
# - ⚠ ドリフト: 現状 frontend の ALB オリジンは旧 ALB DNS(photlas-alb-758841980)を指しているが、
#   live な共有 ALB は photlas-alb-254780620。本 IaC 化の主旨（ドリフト解消）に従い、コードは
#   shared remote state の live ALB DNS を参照する。staging は apply しないため plan には
#   この1点だけ差分が出るが、冬眠解除時の apply で自動的に正しい ALB を指すよう自己修復する。

# ===== 共有/マネージドポリシー参照 =====
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# /tags SSR 用カスタム cache policy（prod state 所有・account グローバル）
data "aws_cloudfront_cache_policy" "tags" {
  name = "photlas-tags-ssr"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

# セキュリティヘッダ用カスタム RHP（prod state 所有・account グローバル）
data "aws_cloudfront_response_headers_policy" "security" {
  name = "photlas-security-headers"
}

# 共有 OAC photlas-s3-oac（prod state 所有・staging frontend も参照）。id は staging.tfvars。
data "aws_cloudfront_origin_access_control" "s3_shared" {
  id = var.shared_s3_oac_id
}

# ===== staging cdn 専用 OAC（import 対象）=====
resource "aws_cloudfront_origin_access_control" "uploads_test" {
  name                              = "photlas-uploads-test-oac"
  description                       = "OAC for Photlas uploads test bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ===== メンテ用 CloudFront Function（コードは運用トグル → ignore_changes）=====
resource "aws_cloudfront_function" "frontend_test" {
  name    = "photlas-frontend-fn-test"
  runtime = "cloudfront-js-2.0"
  comment = "maintenance"
  publish = true

  # 実体のコードは maintenance-on/off.sh が差し替えるため ignore_changes で無視する。
  # ここはリソース再作成時のみ使われる最小 passthrough。
  code = <<-EOT
    function handler(event) {
      return event.request;
    }
  EOT

  # publish は import で読み戻されない TF メタ項目（API 属性ではない）。実体は常に publish 済みのため無視する。
  lifecycle {
    ignore_changes = [code, comment, publish]
  }
}

# ===== frontend ディストリビューション（E33UFH77Q11V2Q / test.photlas.jp）=====
# 既定=S3(OAC), /api/*・/tags/*・/photo-viewer/*=ALB。全ビヘイビアにメンテ Function を関連付け。
resource "aws_cloudfront_distribution" "frontend_test" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Photlas Frontend Test"
  aliases             = ["test.photlas.jp"]
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  http_version        = "http2"

  origin {
    origin_id                = "S3-photlas-frontend-test"
    domain_name              = "photlas-frontend-test-${data.aws_caller_identity.current.account_id}.s3.${var.region}.amazonaws.com"
    origin_access_control_id = data.aws_cloudfront_origin_access_control.s3_shared.id
  }

  origin {
    origin_id   = "ALB-photlas-test"
    domain_name = data.terraform_remote_state.shared.outputs.alb_dns_name

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }
  }

  default_cache_behavior {
    target_origin_id           = "S3-photlas-frontend-test"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.frontend_test.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "ALB-photlas-test"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.frontend_test.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/tags/*"
    target_origin_id           = "ALB-photlas-test"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.tags.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.frontend_test.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/photo-viewer/*"
    target_origin_id           = "ALB-photlas-test"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.frontend_test.arn
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
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

# ===== test-cdn ディストリビューション（E2QUQ7UASG8U7W / test-cdn.photlas.jp）=====
# S3 photlas-uploads-test を配信。専用 OAC。RHP/Function 無し。
resource "aws_cloudfront_distribution" "cdn_test" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "Photlas Uploads Test CDN"
  aliases         = ["test-cdn.photlas.jp"]
  price_class     = "PriceClass_200"
  http_version    = "http2"

  origin {
    origin_id                = "S3-photlas-uploads-test"
    domain_name              = "photlas-uploads-test-${data.aws_caller_identity.current.account_id}.s3.${var.region}.amazonaws.com"
    origin_access_control_id = aws_cloudfront_origin_access_control.uploads_test.id
  }

  default_cache_behavior {
    target_origin_id         = "S3-photlas-uploads-test"
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
