# staging A レコード（alias）。ゾーン本体は data source 参照（決定 I）。
#   test.photlas.jp → CloudFront(frontend) / test-api.photlas.jp → ALB / test-cdn.photlas.jp → CloudFront(cdn)
# ※ test-api は現状 stale な旧 ALB DNS を指すが、本 IaC 化の主旨に従い live な共有 ALB を参照する
#   （CloudFront 同様、冬眠解除時の apply で自己修復。staging は未 apply のため plan に差分が残る）。

data "aws_route53_zone" "main" {
  name         = "photlas.jp."
  private_zone = false
}

resource "aws_route53_record" "test" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "test.photlas.jp"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend_test.domain_name
    zone_id                = aws_cloudfront_distribution.frontend_test.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "test_api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "test-api.photlas.jp"
  type    = "A"

  alias {
    name                   = data.terraform_remote_state.shared.outputs.alb_dns_name
    zone_id                = data.terraform_remote_state.shared.outputs.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "test_cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "test-cdn.photlas.jp"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn_test.domain_name
    zone_id                = aws_cloudfront_distribution.cdn_test.hosted_zone_id
    evaluate_target_health = false
  }
}
