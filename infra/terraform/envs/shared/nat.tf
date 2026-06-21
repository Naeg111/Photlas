# NAT Gateway（private サブネットのアウトバウンド）＋ 専用 EIP
# 冬眠で最も効くコスト削減対象（NAT≈¥8,160/月）。将来 enabled トグルで畳めるようにする。
# 実構成: NAT は public_1a に配置、EIP=35.74.20.164（タグ無し）。

resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id     = aws_eip.nat.id
  subnet_id         = aws_subnet.public_1a.id
  connectivity_type = "public"
}
