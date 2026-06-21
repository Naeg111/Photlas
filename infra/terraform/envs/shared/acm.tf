# ACM 証明書（shared）
# ap-northeast-1: ALB の HTTPS リスナー用 / us-east-1: CloudFront 用（CloudFront は us-east-1 のみ）
# いずれも photlas.jp + *.photlas.jp、DNS 検証・発行済み（AMAZON_ISSUED）。
# 検証 CNAME（_2391fa...）は管理対象外（決定 I）。証明書は誤削除すると致命的なため prevent_destroy。

resource "aws_acm_certificate" "alb" {
  domain_name               = "photlas.jp"
  subject_alternative_names = ["*.photlas.jp"]
  validation_method         = "DNS"

  tags = {
    Name = "photlas-wildcard-cert"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_acm_certificate" "cloudfront" {
  provider = aws.us_east_1

  domain_name               = "photlas.jp"
  subject_alternative_names = ["*.photlas.jp"]
  validation_method         = "DNS"

  lifecycle {
    prevent_destroy = true
  }
}
