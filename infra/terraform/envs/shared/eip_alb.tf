# ALB の静的公開 IP（13.192.57.161 / 54.65.139.97）
# これらは ALB の ENI に out-of-band で関連付けられており、ALB の実際の公開 IP。
# aws_lb は EIP を直接管理できないため、EIP 割り当てのみを管理して「誤解放」を防ぐ（保護）。
# 注意:
#   - ENI への関連付けは AWS 管理 ENI 相手で Terraform から綺麗に管理できないため未管理。
#     冬眠で ALB を作り直す場合、これらの EIP の再関連付けは手動対応が必要。
#   - 許可リスト（allowlist）登録の有無は不明（2026-06 時点・要確認）。不要と判明したら
#     prevent_destroy を外して解放するクリーンアップが可能。

resource "aws_eip" "alb_1a" {
  domain = "vpc"

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_eip" "alb_1c" {
  domain = "vpc"

  lifecycle {
    prevent_destroy = true
  }
}
