# 本番エッジ：ターゲットグループ + ALB host/path リスナールール
# ALB 本体/リスナー(443)は shared。ルールは shared の 443 リスナーに足す（remote state 参照）。
# tg-prod の EC2 登録(aws_lb_target_group_attachment)は EC2 増分で追加。
# #136 §9(/tags)・#58 §6(/photo-viewer) の手動ルールはここに取り込まれる。

resource "aws_lb_target_group" "prod" {
  name        = "photlas-tg-prod"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = data.terraform_remote_state.shared.outputs.vpc_id
  target_type = "instance"

  health_check {
    path                = "/api/v1/health"
    protocol            = "HTTP"
    port                = "traffic-port"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

# 優先度10: api.photlas.jp → tg-prod
resource "aws_lb_listener_rule" "api_subdomain" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 10

  action {
    type = "forward"

    forward {
      target_group {
        arn = aws_lb_target_group.prod.arn
      }
    }
  }

  condition {
    host_header {
      values = ["api.photlas.jp"]
    }
  }
}

# 優先度15: photlas.jp + /api/* → tg-prod
resource "aws_lb_listener_rule" "api_path" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 15

  action {
    type = "forward"

    forward {
      target_group {
        arn = aws_lb_target_group.prod.arn
      }
    }
  }

  condition {
    host_header {
      values = ["photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# 優先度35: photlas.jp + /tags/* → tg-prod（#136 §9）
resource "aws_lb_listener_rule" "tags" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 35

  action {
    type = "forward"

    forward {
      target_group {
        arn = aws_lb_target_group.prod.arn
      }
    }
  }

  condition {
    host_header {
      values = ["photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/tags/*"]
    }
  }
}

# 優先度36: photlas.jp + /photo-viewer/* → tg-prod（#58 §6）
resource "aws_lb_listener_rule" "photo_viewer" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 36

  action {
    type = "forward"

    forward {
      target_group {
        arn = aws_lb_target_group.prod.arn
      }
    }
  }

  condition {
    host_header {
      values = ["photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/photo-viewer/*"]
    }
  }
}
