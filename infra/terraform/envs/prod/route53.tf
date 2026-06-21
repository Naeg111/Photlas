# 本番 A レコード（alias）。ゾーン本体は data source 参照（決定 I：メール系は dns-email）。
#   photlas.jp → CloudFront(frontend) / api.photlas.jp → ALB / cdn.photlas.jp → CloudFront(cdn)

data "aws_route53_zone" "main" {
  name         = "photlas.jp."
  private_zone = false
}

resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "photlas.jp"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.photlas.jp"
  type    = "A"

  alias {
    name                   = data.terraform_remote_state.shared.outputs.alb_dns_name
    zone_id                = data.terraform_remote_state.shared.outputs.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "cdn" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "cdn.photlas.jp"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cdn.domain_name
    zone_id                = aws_cloudfront_distribution.cdn.hosted_zone_id
    evaluate_target_health = false
  }
}
