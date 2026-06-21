# dns-email レイヤー（state④・決定 I）
# メール系 DNS レコード（MX/SPF/DKIM/DMARC/SES MAIL FROM）を隔離管理する。
# アプリと無関係で静的、かつ事故時の被害が大きい（メール停止＝パスワードリセット/本人確認/
# モデレーション通知が止まる）ため、冬眠の destroy/apply 経路に含めない独立 state に置く。
# Route53 ゾーン本体は data source 参照（決定 I：作らない/壊さない）。各レコードに prevent_destroy。
# ImprovMX ダッシュボード側設定（転送エイリアス等）は documents/06_運用/14_ImprovMX管理画面設定.md。

data "aws_route53_zone" "main" {
  name         = "photlas.jp."
  private_zone = false
}
