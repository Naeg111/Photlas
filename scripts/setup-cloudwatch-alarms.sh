#!/bin/bash
#
# CloudWatch アラーム セットアップスクリプト
# 使い方: ALERT_EMAIL=your@email.com ./setup-cloudwatch-alarms.sh [staging|prod]
#

set -euo pipefail

ENVIRONMENT="${1:-staging}"
REGION="ap-northeast-1"

# 環境別の設定
if [ "$ENVIRONMENT" = "prod" ]; then
  INSTANCE_ID="i-083e8c40050732b8f"
  CLOUDFRONT_DISTRIBUTION_ID="E3RXKAXCTDAFOI"
  SNS_TOPIC_NAME="photlas-prod-alerts"
  ALARM_PREFIX="Photlas-Prod"
elif [ "$ENVIRONMENT" = "staging" ]; then
  INSTANCE_ID="i-075d50b85132855ba"
  CLOUDFRONT_DISTRIBUTION_ID="E33UFH77Q11V2Q"
  SNS_TOPIC_NAME="photlas-staging-alerts"
  ALARM_PREFIX="Photlas-Staging"
else
  echo "Usage: $0 [staging|prod]"
  exit 1
fi

# メール通知先（環境変数から取得）
if [ -z "${ALERT_EMAIL:-}" ]; then
  echo "Error: ALERT_EMAIL environment variable is required"
  echo "Usage: ALERT_EMAIL=your@email.com $0 $ENVIRONMENT"
  exit 1
fi

echo "=== Setting up CloudWatch alarms for $ENVIRONMENT ==="
echo "Instance: $INSTANCE_ID"
echo "Alert email: $ALERT_EMAIL"

# SNSトピック作成
echo "=== Creating SNS topic ==="
TOPIC_ARN=$(aws sns create-topic \
  --name "$SNS_TOPIC_NAME" \
  --region "$REGION" \
  --query "TopicArn" \
  --output text)
echo "Topic ARN: $TOPIC_ARN"

# メールサブスクリプション追加
echo "=== Adding email subscription ==="
aws sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol email \
  --notification-endpoint "$ALERT_EMAIL" \
  --region "$REGION"
echo "Subscription created. Please confirm the email."

# アラーム1: EC2 CPU使用率 > 80%（5分間）
echo "=== Creating CPU utilization alarm ==="
aws cloudwatch put-metric-alarm \
  --alarm-name "${ALARM_PREFIX}-HighCPU" \
  --alarm-description "EC2 CPU utilization exceeds 80% for 5 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --alarm-actions "$TOPIC_ARN" \
  --ok-actions "$TOPIC_ARN" \
  --region "$REGION"

# アラーム2: EC2 StatusCheckFailed
echo "=== Creating status check alarm ==="
aws cloudwatch put-metric-alarm \
  --alarm-name "${ALARM_PREFIX}-StatusCheckFailed" \
  --alarm-description "EC2 instance status check failed" \
  --metric-name StatusCheckFailed \
  --namespace AWS/EC2 \
  --statistic Maximum \
  --period 300 \
  --threshold 0 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions "Name=InstanceId,Value=$INSTANCE_ID" \
  --alarm-actions "$TOPIC_ARN" \
  --ok-actions "$TOPIC_ARN" \
  --region "$REGION"

# アラーム3: CloudFront 5xxエラー率 > 5%
echo "=== Creating CloudFront 5xx error alarm ==="
aws cloudwatch put-metric-alarm \
  --alarm-name "${ALARM_PREFIX}-CloudFront5xxErrors" \
  --alarm-description "CloudFront 5xx error rate exceeds 5%" \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions "Name=DistributionId,Value=$CLOUDFRONT_DISTRIBUTION_ID" "Name=Region,Value=Global" \
  --alarm-actions "$TOPIC_ARN" \
  --ok-actions "$TOPIC_ARN" \
  --region "us-east-1"

echo ""
echo "=== Setup complete ==="
echo "Alarms created:"
echo "  - ${ALARM_PREFIX}-HighCPU (CPU > 80%)"
echo "  - ${ALARM_PREFIX}-StatusCheckFailed (Instance health)"
echo "  - ${ALARM_PREFIX}-CloudFront5xxErrors (5xx > 5%)"
echo ""
echo "IMPORTANT: Check your email ($ALERT_EMAIL) and confirm the SNS subscription."
