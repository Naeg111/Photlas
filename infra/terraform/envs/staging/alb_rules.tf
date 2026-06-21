# staging エッジ：tg-test + ALB host/path ルール（共有 ALB の 443 リスナーに足す）
# 生存リソース（冬眠で削除されず）。EC2 登録は EC2 復旧時に追加。

resource "aws_lb_target_group" "test" {
  name        = "photlas-tg-test"
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

# 優先度20: test-api.photlas.jp → tg-test
resource "aws_lb_listener_rule" "api_subdomain" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 20

  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.test.arn
      }
    }
  }

  condition {
    host_header {
      values = ["test-api.photlas.jp"]
    }
  }
}

# 優先度25: test.photlas.jp + /api/* → tg-test
resource "aws_lb_listener_rule" "api_path" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 25

  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.test.arn
      }
    }
  }

  condition {
    host_header {
      values = ["test.photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# 優先度30: test.photlas.jp + /tags/* → tg-test
resource "aws_lb_listener_rule" "tags" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 30

  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.test.arn
      }
    }
  }

  condition {
    host_header {
      values = ["test.photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/tags/*"]
    }
  }
}

# 優先度31: test.photlas.jp + /photo-viewer/* → tg-test
resource "aws_lb_listener_rule" "photo_viewer" {
  listener_arn = data.terraform_remote_state.shared.outputs.alb_https_listener_arn
  priority     = 31

  action {
    type = "forward"
    forward {
      target_group {
        arn = aws_lb_target_group.test.arn
      }
    }
  }

  condition {
    host_header {
      values = ["test.photlas.jp"]
    }
  }

  condition {
    path_pattern {
      values = ["/photo-viewer/*"]
    }
  }
}
