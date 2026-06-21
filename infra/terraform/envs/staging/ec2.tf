# staging アプリサーバ EC2（冬眠で削除済み → コードのみ・apply は冬眠解除時・§5.3）
# 使い捨て・アプリは CI 再デプロイで復元。AMI は冬眠時に退避した staging イメージを起点に
# するが、CI 運用で変わりうるため ignore_changes。instance profile / SG は prod と共用
# （PhotlasEC2Role・app SG）で name 参照（prod state が所有）。
#
# ⚠ このリソースは import していない（実体が無い）。staging を冬眠解除する時に初めて apply する。

resource "aws_instance" "test" {
  ami           = "ami-04c7b605c30330a90" # photlas-app-test-server 冬眠 AMI（CI 再デプロイで上書き前提）
  instance_type = "t4g.small"
  subnet_id     = data.terraform_remote_state.shared.outputs.private_subnet_ids[0] # private_1a

  vpc_security_group_ids = [data.terraform_remote_state.shared.outputs.app_security_group_id]
  iam_instance_profile   = "PhotlasEC2Role" # prod と共用（prod state 所有）
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
    delete_on_termination = true
  }

  tags = {
    Name = "photlas-app-test-server"
  }

  lifecycle {
    ignore_changes = [ami, user_data, user_data_base64]
  }
}

# EC2 を tg-test に 8080 で登録（冬眠解除時に EC2 と同時に作成）
resource "aws_lb_target_group_attachment" "test" {
  target_group_arn = aws_lb_target_group.test.arn
  target_id        = aws_instance.test.id
  port             = 8080
}
