variable "region" {
  description = "主要リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "state_bucket" {
  description = "Terraform state を置く S3 バケット名。具体値は staging.tfvars（Git 管理外）。"
  type        = string
}
