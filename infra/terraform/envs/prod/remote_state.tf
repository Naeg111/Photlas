# shared レイヤーの出力を参照（VPC/サブネット/ALB/SG/ACM 等）
data "terraform_remote_state" "shared" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "shared/terraform.tfstate"
    region = var.region
  }
}
