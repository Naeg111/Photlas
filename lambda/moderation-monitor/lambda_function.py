"""
Issue#54: コンテンツモデレーション - 監視用Lambda関数

EventBridge（5分間隔）でトリガーされ、PENDING_REVIEWのまま
5分以上経過した投稿がないかバックエンドAPIをチェックする。
該当がある場合はSlack通知する。

環境変数:
  BACKEND_API_URL: バックエンドAPIのベースURL（例: https://test-api.photlas.jp）
  MODERATION_API_KEY: バックエンドAPI認証用APIキー
  SLACK_WEBHOOK_URL: Slack通知用Webhook URL（任意）
  STALE_THRESHOLD_MINUTES: 滞留閾値（デフォルト: 5分）
"""

import json
import logging
import os
import urllib.request
import urllib.error

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 環境変数
BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "")
MODERATION_API_KEY = os.environ.get("MODERATION_API_KEY", "")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
STALE_THRESHOLD_MINUTES = int(os.environ.get("STALE_THRESHOLD_MINUTES", "5"))


def lambda_handler(event, context):
    """PENDING_REVIEW滞留チェックを実行する。"""
    logger.info("監視Lambda実行開始")

    try:
        stale_count = check_stale_pending_reviews()

        if stale_count > 0:
            logger.warning("滞留中のPENDING_REVIEW投稿: %d件", stale_count)
            send_slack_alert(stale_count)
        else:
            logger.info("滞留なし")

        return {
            "statusCode": 200,
            "body": json.dumps({"stale_count": stale_count}),
        }

    except Exception:
        logger.exception("監視Lambda処理でエラー")
        send_slack_error_alert()
        raise


def check_stale_pending_reviews():
    """バックエンドAPIに滞留チェックをリクエストする。

    Returns:
        int: 滞留中のPENDING_REVIEW投稿数
    """
    url = (
        f"{BACKEND_API_URL}/api/v1/internal/moderation/stale-check"
        f"?threshold_minutes={STALE_THRESHOLD_MINUTES}"
    )

    req = urllib.request.Request(
        url,
        headers={"X-API-Key": MODERATION_API_KEY},
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("stale_count", 0)
    except urllib.error.HTTPError as e:
        logger.error("滞留チェックAPI失敗: status=%d, body=%s", e.code, e.read().decode())
        raise
    except urllib.error.URLError as e:
        logger.error("滞留チェックAPI接続エラー: %s", e.reason)
        raise


def send_slack_alert(stale_count):
    """PENDING_REVIEW滞留のSlackアラートを送信する。"""
    if not SLACK_WEBHOOK_URL:
        logger.info("Slack Webhook URLが未設定のためスキップ")
        return

    payload = json.dumps({
        "text": f":warning: *PENDING_REVIEW滞留アラート*\n"
                f"PENDING_REVIEWのまま{STALE_THRESHOLD_MINUTES}分以上経過した投稿が"
                f"*{stale_count}件* あります。\n"
                f"Lambda障害またはS3イベント未発火の可能性があります。",
    }).encode("utf-8")

    _send_slack(payload)


def send_slack_error_alert():
    """監視Lambda自体のエラーをSlackに通知する。"""
    if not SLACK_WEBHOOK_URL:
        return

    payload = json.dumps({
        "text": ":rotating_light: *監視Lambda実行エラー*\n"
                "PENDING_REVIEW滞留チェックの実行中にエラーが発生しました。",
    }).encode("utf-8")

    _send_slack(payload)


def _send_slack(payload):
    """Slackにメッセージを送信する。"""
    req = urllib.request.Request(
        SLACK_WEBHOOK_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=5):
            logger.info("Slack通知送信完了")
    except Exception:
        logger.warning("Slack通知の送信に失敗しました", exc_info=True)
