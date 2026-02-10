#!/bin/bash
# RDS自動バックアップ設定スクリプト
# 使用方法: RDS_INSTANCE_ID=your-instance-id ./scripts/setup-rds-backup.sh [staging|prod]

set -euo pipefail

ENVIRONMENT=${1:-staging}
RDS_INSTANCE_ID=${RDS_INSTANCE_ID:?RDS_INSTANCE_IDを環境変数に設定してください}
AWS_REGION=${AWS_REGION:-ap-northeast-1}
BACKUP_RETENTION_PERIOD=${BACKUP_RETENTION_PERIOD:-7}

echo "=== RDSバックアップ設定 (${ENVIRONMENT}) ==="
echo "RDSインスタンス: ${RDS_INSTANCE_ID}"
echo "リージョン: ${AWS_REGION}"
echo "バックアップ保持期間: ${BACKUP_RETENTION_PERIOD}日"

# 1. 自動バックアップの有効化（保持期間設定）
echo ""
echo "=== 自動バックアップ有効化 ==="
aws rds modify-db-instance \
  --db-instance-identifier "${RDS_INSTANCE_ID}" \
  --backup-retention-period "${BACKUP_RETENTION_PERIOD}" \
  --preferred-backup-window "18:00-19:00" \
  --region "${AWS_REGION}" \
  --apply-immediately \
  --no-cli-pager

echo "自動バックアップが有効化されました（保持期間: ${BACKUP_RETENTION_PERIOD}日、バックアップウィンドウ: 18:00-19:00 UTC = 03:00-04:00 JST）"

# 2. 手動スナップショット作成
SNAPSHOT_ID="photlas-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
echo ""
echo "=== 手動スナップショット作成 ==="
echo "スナップショットID: ${SNAPSHOT_ID}"

aws rds create-db-snapshot \
  --db-instance-identifier "${RDS_INSTANCE_ID}" \
  --db-snapshot-identifier "${SNAPSHOT_ID}" \
  --region "${AWS_REGION}" \
  --no-cli-pager

echo "スナップショット作成を開始しました: ${SNAPSHOT_ID}"

# 3. 現在のバックアップ設定を確認
echo ""
echo "=== 現在のバックアップ設定 ==="
aws rds describe-db-instances \
  --db-instance-identifier "${RDS_INSTANCE_ID}" \
  --region "${AWS_REGION}" \
  --query "DBInstances[0].{InstanceId:DBInstanceIdentifier,BackupRetention:BackupRetentionPeriod,BackupWindow:PreferredBackupWindow,LatestRestorableTime:LatestRestorableTime}" \
  --output table \
  --no-cli-pager

echo ""
echo "=== 設定完了 ==="
echo "自動バックアップ: 毎日 03:00-04:00 JST"
echo "保持期間: ${BACKUP_RETENTION_PERIOD}日"
echo "手動スナップショット: ${SNAPSHOT_ID}"
