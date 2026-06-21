# セキュリティグループ（shared）
# 構成（describe-security-group-rules）:
#   alb-sg : in 443/80 from 0.0.0.0/0, out all
#   app-sg : in 8080 from alb-sg,       out all
#   rds-sg : in 5432 from app-sg,       out 無し
#   default: in self(all),              out all
# ルールは個別リソース（aws_vpc_security_group_*_rule）で管理（モダン推奨）。
# グループ本体にはインラインルールを書かない（衝突回避）。

resource "aws_security_group" "alb" {
  name        = "photlas-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "app" {
  name        = "photlas-app-sg"
  description = "Security group for application servers"
  vpc_id      = aws_vpc.main.id
}

resource "aws_security_group" "rds" {
  name        = "photlas-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id
}

# VPC デフォルト SG（self ingress / all egress）はインラインで管理（adopt）
resource "aws_default_security_group" "default" {
  vpc_id = aws_vpc.main.id

  ingress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    self      = true
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---- alb-sg ルール ----
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "from the Internet"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "for HTTP redirection"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  description       = "default"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- app-sg ルール ----
resource "aws_vpc_security_group_ingress_rule" "app_from_alb_8080" {
  security_group_id            = aws_security_group.app.id
  description                  = "Communications from ALB only"
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
  referenced_security_group_id = aws_security_group.alb.id
}

resource "aws_vpc_security_group_egress_rule" "app_internet" {
  security_group_id = aws_security_group.app.id
  description       = "Internet access"
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# ---- rds-sg ルール（ingress のみ）----
resource "aws_vpc_security_group_ingress_rule" "rds_from_app_5432" {
  security_group_id            = aws_security_group.rds.id
  description                  = "Connection via the app only"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.app.id
}
