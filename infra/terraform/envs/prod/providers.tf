provider "aws" {
  region = var.region
}

# CloudFront / CloudFront 用 ACM は us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
