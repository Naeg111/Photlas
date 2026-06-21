variable "region" {
  description = "主要リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "state_bucket" {
  description = "Terraform state を置く S3 バケット名。具体値は staging.tfvars（Git 管理外）。"
  type        = string
}

# 共有 OAC（photlas-s3-oac）は prod state が所有。staging frontend も同じ OAC を使うため
# data source(id) で参照する。OAC には data source の name 引数が無いので id を変数で渡す。
variable "shared_s3_oac_id" {
  description = "共有 OAC photlas-s3-oac の ID（staging frontend が参照）。具体値は staging.tfvars（Git 管理外）。"
  type        = string
}

variable "moderation_api_key" {
  description = "Lambda が backend を呼ぶための API キー（機密）。実値は staging.tfvars（Git 管理外）で渡す。"
  type        = string
  sensitive   = true
}
