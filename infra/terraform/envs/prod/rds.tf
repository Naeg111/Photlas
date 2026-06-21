# RDS（本番 PostgreSQL）＋サブネットグループ
# 冬眠設計(§5.3): destroy 時に final snapshot、復旧は snapshot から。prevent_destroy で誤削除防止。

resource "aws_db_subnet_group" "main" {
  name        = "photlas-db-subnet-group"
  description = "Photlas database subnet group"
  subnet_ids  = data.terraform_remote_state.shared.outputs.db_subnet_ids
}

resource "aws_db_instance" "prod" {
  identifier     = "photlas-db-prod"
  engine         = "postgres"
  engine_version = "17.9"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "photlas"
  username = "postgres"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [data.terraform_remote_state.shared.outputs.rds_security_group_id]
  parameter_group_name   = "default.postgres17"
  port                   = 5432

  multi_az            = false
  availability_zone   = "ap-northeast-1a"
  publicly_accessible = false

  backup_retention_period = 7
  backup_window           = "18:28-18:58"
  maintenance_window      = "fri:19:05-fri:19:35"

  auto_minor_version_upgrade = true
  ca_cert_identifier         = "rds-ca-rsa2048-g1"

  deletion_protection = true

  # 冬眠(§5.3): 畳む時のみ skip_final_snapshot/prevent_destroy を外す運用
  skip_final_snapshot       = false
  final_snapshot_identifier = "photlas-db-prod-final"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [password]
  }
}
