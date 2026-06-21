# メール系 DNS レコード（決定 I）。各レコードに prevent_destroy で誤削除を防止する。
#
# 内訳:
#   - 受信(ImprovMX): MX photlas.jp / TXT 46cc8ed9._improvmx（検証）
#   - 送信(Amazon SES): DKIM CNAME×3 / mail.photlas.jp の MX+SPF（カスタム MAIL FROM）
#   - ポリシー: SPF(photlas.jp)・DMARC(_dmarc)
#   - photlas.jp の TXT は SPF と同居（improvmx-verify・google-site-verification×2 も同梱・§3.1）
#   - ACM 検証 CNAME（_2391fa…）も静的・致命的なため同梱（§3.1：dns-email に同梱可）

locals {
  zone_id = data.aws_route53_zone.main.zone_id
}

# ===== 受信メール（ImprovMX）=====
resource "aws_route53_record" "mx" {
  zone_id = local.zone_id
  name    = "photlas.jp"
  type    = "MX"
  ttl     = 300
  records = [
    "10 mx1.improvmx.com",
    "20 mx2.improvmx.com",
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_record" "improvmx_verify" {
  zone_id = local.zone_id
  name    = "46cc8ed9._improvmx.photlas.jp"
  type    = "TXT"
  ttl     = 300
  records = ["46cc8ed97e1b45b18256be8c0e9d09bc"]

  lifecycle {
    prevent_destroy = true
  }
}

# ===== SPF（+ improvmx-verify / google-site-verification を同居）=====
# Route53 は同名同型を1リソースにまとめる必要があるため、photlas.jp の TXT 4 値を1レコードで管理。
resource "aws_route53_record" "txt_apex" {
  zone_id = local.zone_id
  name    = "photlas.jp"
  type    = "TXT"
  ttl     = 300
  records = [
    "v=spf1 include:amazonses.com include:spf.improvmx.com ~all",
    "improvmx-verify=photlas.support@gmail.com",
    "google-site-verification=NYfxZa7HIbHMxaVEX6W09mMw-7fN-te9xqYMfrBnbUE",
    "google-site-verification=2hl_2k3iGeN5Z7sq4UDeCzI_-0tzuNlgC7CEolQXHiU",
  ]

  lifecycle {
    prevent_destroy = true
  }
}

# ===== DMARC =====
resource "aws_route53_record" "dmarc" {
  zone_id = local.zone_id
  name    = "_dmarc.photlas.jp"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=none; rua=mailto:dmarc@photlas.jp"]

  lifecycle {
    prevent_destroy = true
  }
}

# ===== SES DKIM（CNAME×3）=====
resource "aws_route53_record" "dkim_1" {
  zone_id = local.zone_id
  name    = "ccrdhi2h2vupzgvzhnlrhxclzagt5nao._domainkey.photlas.jp"
  type    = "CNAME"
  ttl     = 300
  records = ["ccrdhi2h2vupzgvzhnlrhxclzagt5nao.dkim.amazonses.com"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_record" "dkim_2" {
  zone_id = local.zone_id
  name    = "gemb3gsnfiyoi3bycfako3lb5rwgvkoh._domainkey.photlas.jp"
  type    = "CNAME"
  ttl     = 300
  records = ["gemb3gsnfiyoi3bycfako3lb5rwgvkoh.dkim.amazonses.com"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_record" "dkim_3" {
  zone_id = local.zone_id
  name    = "yl62fokx4c5eruxy32mze6xg2pnwzyqc._domainkey.photlas.jp"
  type    = "CNAME"
  ttl     = 300
  records = ["yl62fokx4c5eruxy32mze6xg2pnwzyqc.dkim.amazonses.com"]

  lifecycle {
    prevent_destroy = true
  }
}

# ===== SES カスタム MAIL FROM（mail.photlas.jp）=====
resource "aws_route53_record" "mail_from_mx" {
  zone_id = local.zone_id
  name    = "mail.photlas.jp"
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.ap-northeast-1.amazonses.com"]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = local.zone_id
  name    = "mail.photlas.jp"
  type    = "TXT"
  ttl     = 300
  records = ["v=spf1 include:amazonses.com ~all"]

  lifecycle {
    prevent_destroy = true
  }
}

# ===== ACM 検証 CNAME（静的・致命的・§3.1 で dns-email に同梱可）=====
resource "aws_route53_record" "acm_validation" {
  zone_id = local.zone_id
  name    = "_2391fa1970e93014e1eb60b993fd15b5.photlas.jp"
  type    = "CNAME"
  ttl     = 300
  records = ["_4a28bf8bc85d10b19700fa4cd5f9a83c.jkddzztszm.acm-validations.aws."]

  lifecycle {
    prevent_destroy = true
  }
}
