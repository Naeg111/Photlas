# VPC・サブネット・IGW（shared：ネットワーク基盤）
# 実構成（aws ec2 describe-*）:
#   VPC 10.0.0.0/16（photlas-vpc）, enableDnsSupport=true / enableDnsHostnames=false
#   サブネット 6（public/private/db × 1a/1c）, いずれも MapPublicIpOnLaunch=false
#   IGW photlas-igw
# ※ 具体的なリソース ID（vpc-/subnet-/igw-）は HCL に書かず import 時に紐付ける（決定 E）。

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  instance_tenancy     = "default"
  enable_dns_support   = true
  enable_dns_hostnames = false

  tags = {
    Name = "photlas-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "photlas-igw"
  }
}

# ---- public サブネット（ALB 等）----
resource "aws_subnet" "public_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-public-subnet-1a"
  }
}

resource "aws_subnet" "public_1c" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-public-subnet-1c"
  }
}

# ---- private サブネット（EC2/アプリ）----
resource "aws_subnet" "private_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.11.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-private-subnet-1a"
  }
}

resource "aws_subnet" "private_1c" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.12.0/24"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-private-subnet-1c"
  }
}

# ---- db サブネット（RDS）----
resource "aws_subnet" "db_1a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.21.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-db-subnet-1a"
  }
}

resource "aws_subnet" "db_1c" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.22.0/24"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = false

  tags = {
    Name = "photlas-db-subnet-1c"
  }
}
