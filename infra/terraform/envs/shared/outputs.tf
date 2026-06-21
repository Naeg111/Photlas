# shared の出力（prod / staging / dns-email が terraform_remote_state で参照する）

# ---- ネットワーク ----
output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = [aws_subnet.public_1a.id, aws_subnet.public_1c.id]
}

output "private_subnet_ids" {
  value = [aws_subnet.private_1a.id, aws_subnet.private_1c.id]
}

output "db_subnet_ids" {
  value = [aws_subnet.db_1a.id, aws_subnet.db_1c.id]
}

# ---- セキュリティグループ ----
output "alb_security_group_id" {
  value = aws_security_group.alb.id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "rds_security_group_id" {
  value = aws_security_group.rds.id
}

# ---- ALB（host+path ルールは prod/staging が このリスナーに足す）----
output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main.zone_id
}

output "alb_https_listener_arn" {
  value = aws_lb_listener.https.arn
}

output "alb_http_listener_arn" {
  value = aws_lb_listener.http.arn
}

# ---- ACM ----
output "acm_alb_certificate_arn" {
  value = aws_acm_certificate.alb.arn
}

output "acm_cloudfront_certificate_arn" {
  value = aws_acm_certificate.cloudfront.arn
}

# ---- ECR ----
output "ecr_backend_repository_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  value = aws_ecr_repository.frontend.repository_url
}
