variable "region" {
  description = "主要リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "state_bucket" {
  description = "Terraform state を置く S3 バケット名（shared の remote state 参照に使用）。具体値は prod.tfvars（Git 管理外）で渡す。"
  type        = string
}

variable "db_password" {
  description = "RDS マスターパスワード。AWS から読めないため import 時は ignore_changes で無視（プレースホルダで可）。実値は prod.tfvars（Git 管理外）で渡す。"
  type        = string
  sensitive   = true
}

variable "moderation_api_key" {
  description = "Lambda が backend を呼ぶための API キー（機密）。実値は prod.tfvars（Git 管理外）で渡す。"
  type        = string
  sensitive   = true
}
