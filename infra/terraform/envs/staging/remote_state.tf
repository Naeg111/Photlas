data "terraform_remote_state" "shared" {
  backend = "s3"

  config = {
    bucket = var.state_bucket
    key    = "shared/terraform.tfstate"
    region = var.region
  }
}
