# ルートテーブル（shared）
# 実構成:
#   public（=VPC のデフォルト/メイン RT rtb-09b2... ）: 0.0.0.0/0 → IGW、public_1a/1c を関連付け
#   private-rt-1a / -1c: 0.0.0.0/0 → NAT、private_1a / private_1c を関連付け
#   db-rt: local のみ（アウトバウンド無し）、db_1a / db_1c を関連付け
# ※ 名前/関連付け無しの未使用 RT rtb-02ec8c9e89f7643fb は別途確認のため本 increment では未管理。

# ---- public（VPC のデフォルト/メイン RT rtb-09b2...）----
# 注: aws_default_route_table の import はプロバイダ既知の "empty result" で失敗するため、
#     同じ物理 RT を aws_route_table として取り込む。デフォルト RT は AWS 側で常に main の
#     ままに保たれ、shared の RT は冬眠でも destroy しないため実害なし（main 関連付けは暗黙）。
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "photlas-public-rt"
  }
}

resource "aws_route_table_association" "public_1a" {
  subnet_id      = aws_subnet.public_1a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_1c" {
  subnet_id      = aws_subnet.public_1c.id
  route_table_id = aws_route_table.public.id
}

# ---- private 1a（NAT 経由）----
resource "aws_route_table" "private_1a" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "photlas-private-rt-1a"
  }
}

resource "aws_route_table_association" "private_1a" {
  subnet_id      = aws_subnet.private_1a.id
  route_table_id = aws_route_table.private_1a.id
}

# ---- private 1c（NAT 経由）----
resource "aws_route_table" "private_1c" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "photlas-private-rt-1c"
  }
}

resource "aws_route_table_association" "private_1c" {
  subnet_id      = aws_subnet.private_1c.id
  route_table_id = aws_route_table.private_1c.id
}

# ---- db（local のみ）----
resource "aws_route_table" "db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "photlas-db-rt"
  }
}

resource "aws_route_table_association" "db_1a" {
  subnet_id      = aws_subnet.db_1a.id
  route_table_id = aws_route_table.db.id
}

resource "aws_route_table_association" "db_1c" {
  subnet_id      = aws_subnet.db_1c.id
  route_table_id = aws_route_table.db.id
}
