# Issue#117: メンテナンスモード関連スクリプトの共通定義
#
# scripts/setup-maintenance-function.sh / maintenance-on.sh /
# maintenance-off.sh / maintenance-status.sh から source される。
# 4 スクリプト間で重複していた定数をここに集約する。

# 本番・ステージングが共有する Application Load Balancer 名
ALB_NAME="photlas-alb"

# CloudFront Function publish 後、エッジへの伝播を待機する秒数。
# 実測ベースで 30 秒程度で世界中に反映されるが、地域差を見て余裕を持たせる。
PROPAGATION_WAIT_SEC=30

# AWS リージョン (Photlas は東京リージョンのみで運用)
REGION="ap-northeast-1"
