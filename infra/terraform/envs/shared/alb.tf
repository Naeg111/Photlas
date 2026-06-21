# ALB 本体＋リスナー（shared：prod/staging 共通。host+path ルールは各 env 側）
# 構成: internet-facing / application / ipv4 / SG=alb-sg / public_1a,1c
#   443 HTTPS: ssl=TLS13-1-2-2021-06, cert=ALB用ACM, default=fixed-response 404
#   80  HTTP : default=HTTPS:443 へ 301 リダイレクト
# 属性は全て AWS 既定（idle 60 / http2 on / desync defensive 等）。

resource "aws_lb" "main" {
  name               = "photlas-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_1a.id, aws_subnet.public_1c.id]
  ip_address_type    = "ipv4"

  idle_timeout               = 60
  enable_deletion_protection = false
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.alb.arn

  # マッチしないリクエストは 404（host+path ルールは prod/staging 側で追加）
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      protocol    = "HTTPS"
      port        = "443"
      host        = "#{host}"
      path        = "/#{path}"
      query       = "#{query}"
      status_code = "HTTP_301"
    }
  }
}
