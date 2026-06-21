# staging RDS（冬眠で削除済み → コードのみ・apply は冬眠解除時・§5.3）
# 冬眠解除時は「空 DB を作らず冬眠スナップショットから復元」して staging データを保持する。
# サブネットグループ（photlas-db-subnet-group）は prod と共用（prod state 所有）→ name 参照。
#
# ⚠ このリソースは import していない（実体が無い）。冬眠解除時に snapshot から初回 apply する。

resource "aws_db_instance" "test" {
  identifier     = "photlas-db-staging"
  engine         = "postgres"
  engine_version = "17.6" # スナップショットのバージョン（復元時の強制アップグレードを避ける）
  instance_class = "db.t4g.micro"

  # 冬眠スナップショットから復元（空 DB を作らない）。db_name/username はスナップショットから継承。
  snapshot_identifier = "photlas-db-staging-hibernate-20260602-100932"
  password            = var.db_password

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_subnet_group_name   = "photlas-db-subnet-group" # prod と共用（prod state 所有）
  vpc_security_group_ids = [data.terraform_remote_state.shared.outputs.rds_security_group_id]
  parameter_group_name   = "default.postgres17"
  port                   = 5432

  multi_az            = false
  availability_zone   = "ap-northeast-1c"
  publicly_accessible = false

  backup_retention_period = 7
  backup_window           = "19:57-20:27"
  maintenance_window      = "fri:15:05-fri:15:35"

  auto_minor_version_upgrade = true
  ca_cert_identifier         = "rds-ca-rsa2048-g1"

  deletion_protection = true

  # 冬眠(§5.3): 畳む時のみ skip_final_snapshot/prevent_destroy を外す運用
  skip_final_snapshot       = false
  final_snapshot_identifier = "photlas-db-staging-final"

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [password, snapshot_identifier]
  }
}
