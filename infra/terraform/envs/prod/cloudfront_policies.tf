# CloudFront 用カスタムポリシー（prod ディストリビューションが参照）
# マネージドポリシー(CachingOptimized 等)は data source で参照（cloudfront.tf 側）。

# /tags SSR 用キャッシュポリシー（#136 §9：cache key に lang/page を含める）
resource "aws_cloudfront_cache_policy" "tags" {
  name        = "photlas-tags-ssr"
  comment     = "Issue#136 /tags SSR: cache key = lang+page query, respect origin Cache-Control(max-age=300), gzip/brotli"
  default_ttl = 300
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true

    headers_config {
      header_behavior = "none"
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "whitelist"
      query_strings {
        items = ["page", "lang"]
      }
    }
  }
}

# セキュリティヘッダ（/api/*・/tags/*・/photo-viewer/* と既定に適用）
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "photlas-security-headers"
  comment = "Security headers for Photlas"

  security_headers_config {
    xss_protection {
      override   = false
      protection = false
    }
    frame_options {
      override     = true
      frame_option = "DENY"
    }
    referrer_policy {
      override        = true
      referrer_policy = "strict-origin-when-cross-origin"
    }
    content_security_policy {
      override                = true
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https://*.photlas.jp https://*.cloudfront.net https://*.mapbox.com https://*.s3.ap-northeast-1.amazonaws.com; connect-src 'self' https://*.photlas.jp https://*.mapbox.com https://events.mapbox.com https://www.google-analytics.com https://*.sentry.io https://*.cloudfront.net https://*.s3.ap-northeast-1.amazonaws.com; worker-src 'self' blob:; child-src blob:; frame-src 'none'; object-src 'none'; base-uri 'self';"
    }
    content_type_options {
      override = true
    }
    strict_transport_security {
      override                   = true
      include_subdomains         = true
      preload                    = false
      access_control_max_age_sec = 31536000
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(self), payment=()"
      override = true
    }
  }
}

# S3 オリジン用 Origin Access Control
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "photlas-s3-oac"
  description                       = "OAC for Photlas S3 buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}
