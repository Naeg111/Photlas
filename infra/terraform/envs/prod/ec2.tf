# 本番アプリサーバ EC2（使い捨て・アプリは CI 再デプロイで復元・§5.3）
# AMI/user_data は CI 運用で変わりうるため ignore_changes。

resource "aws_instance" "prod" {
  ami           = "ami-0f7e614a78af8e975"
  instance_type = "t4g.small"
  subnet_id     = data.terraform_remote_state.shared.outputs.private_subnet_ids[0] # private_1a

  vpc_security_group_ids = [data.terraform_remote_state.shared.outputs.app_security_group_id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = "photlas-key"

  ebs_optimized = false
  monitoring    = false

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    http_endpoint               = "enabled"
  }

  root_block_device {
    volume_size           = 8
    volume_type           = "gp3"
    encrypted             = false
    iops                  = 3000
    throughput            = 125
    delete_on_termination = true
  }

  tags = {
    Name = "photlas-app-prod-server"
  }

  lifecycle {
    ignore_changes = [ami, user_data, user_data_base64]
  }
}

# EC2 を tg-prod に 8080 で登録（既存登録済み・RegisterTargets は冪等）
resource "aws_lb_target_group_attachment" "prod" {
  target_group_arn = aws_lb_target_group.prod.arn
  target_id        = aws_instance.prod.id
  port             = 8080
}
