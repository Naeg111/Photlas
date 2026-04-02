"""
Issue#54: コンテンツモデレーション - スキャン用Lambda関数
Issue#84: ラベル除外対応とRekognition v7移行

S3イベントをトリガーに Amazon Rekognition Content Moderation でスキャンし、
結果をバックエンドAPIにコールバックする。

環境変数:
  BACKEND_API_URL: バックエンドAPIのベースURL（例: https://test-api.photlas.jp）
  MODERATION_API_KEY: バックエンドAPI認証用APIキー
  SLACK_WEBHOOK_URL: Slack通知用Webhook URL（任意）
  CONFIDENCE_THRESHOLD_HIGH: 自動QUARANTINED閾値（デフォルト: 50）
  EXCLUDED_LABELS: 除外ラベル（カンマ区切り、例: Smoking,Weapons,Gambling）
"""

import json
import logging
import os
import urllib.request
import urllib.error

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 環境変数
BACKEND_API_URL = os.environ.get("BACKEND_API_URL", "")
MODERATION_API_KEY = os.environ.get("MODERATION_API_KEY", "")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD_HIGH", "50"))

# Issue#84: 除外ラベル（環境変数からカンマ区切りで設定）
EXCLUDED_LABELS = set(
    label.strip()
    for label in os.environ.get("EXCLUDED_LABELS", "").split(",")
    if label.strip()
)

# AWSクライアント
rekognition_client = boto3.client("rekognition")
s3_client = boto3.client("s3")

# モデレーションステータス
STATUS_PUBLISHED = "PUBLISHED"
STATUS_QUARANTINED = "QUARANTINED"

# Issue#84: CSAM関連のRekognitionラベル（v7対応）
CSAM_LABELS = {
    "Explicit Nudity",
    "Explicit Sexual Activity",
    "Exposed Male Genitalia",
    "Exposed Female Genitalia",
    "Exposed Buttocks or Anus",
    "Exposed Female Nipple",
}

# Issue#84: デフォルト除外ラベル（写真共有サービスとして許容するコンテンツ）
DEFAULT_EXCLUDED_LABELS = {
    "Non-Explicit Nudity", "Obstructed Intimate Parts", "Kissing on the Lips",
    "Swimwear or Underwear", "Weapons", "Products",
    "Drugs & Tobacco Paraphernalia & Use", "Alcohol Use", "Alcoholic Beverages",
    "Gambling", "Smoking",
    # L3ラベル（L2除外時に自動的にカバーされるが明示的に含める）
    "Bare Back", "Exposed Male Nipple", "Partially Exposed Buttocks",
    "Partially Exposed Female Breast", "Implied Nudity",
    "Obstructed Female Nipple", "Obstructed Male Genitalia",
    "Female Swimwear or Underwear", "Male Swimwear or Underwear",
    "Drinking", "Pills",
}

# 隔離用プレフィックス
QUARANTINED_PREFIX = "quarantined/"


def lambda_handler(event, context):
    """S3イベントをトリガーにRekognitionスキャンを実行する。"""
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        object_key = record["s3"]["object"]["key"]

        # 隔離プレフィックスのオブジェクトはスキップ
        if object_key.startswith(QUARANTINED_PREFIX):
            logger.info("隔離プレフィックスのためスキップ: %s", object_key)
            continue

        logger.info("スキャン開始: bucket=%s, key=%s", bucket, object_key)

        try:
            result = scan_image(bucket, object_key)
            status, confidence, is_csam = evaluate_result(result)

            logger.info(
                "スキャン結果: key=%s, status=%s, confidence=%.2f, csam=%s",
                object_key, status, confidence, is_csam,
            )

            # バックエンドAPIにコールバック
            callback_to_backend(object_key, status, confidence)

            # QUARANTINED時の追加処理
            if status == STATUS_QUARANTINED:
                move_to_quarantine(bucket, object_key)
                send_slack_notification(object_key, confidence, is_csam, result)

        except Exception:
            logger.exception("スキャン処理でエラー: key=%s", object_key)
            raise


def scan_image(bucket, object_key):
    """Amazon Rekognition Content Moderationでスキャンする。"""
    response = rekognition_client.detect_moderation_labels(
        Image={"S3Object": {"Bucket": bucket, "Name": object_key}},
        MinConfidence=30,
    )
    return response.get("ModerationLabels", [])


def evaluate_result(labels):
    """スキャン結果を評価し、ステータス・信頼度・CSAMフラグを返す。

    Issue#84: 除外ラベルをフィルタリング後に判定する。

    Returns:
        tuple: (status, max_confidence, is_csam)
    """
    if not labels:
        return STATUS_PUBLISHED, 0.0, False

    # 除外ラベルをフィルタリング（環境変数 + デフォルト）
    all_excluded = EXCLUDED_LABELS | DEFAULT_EXCLUDED_LABELS
    filtered = [l for l in labels if l["Name"] not in all_excluded]

    if not filtered:
        return STATUS_PUBLISHED, 0.0, False

    max_confidence = max(label["Confidence"] for label in filtered)
    is_csam = any(label["Name"] in CSAM_LABELS for label in filtered)

    if max_confidence >= CONFIDENCE_THRESHOLD:
        return STATUS_QUARANTINED, max_confidence, is_csam

    return STATUS_PUBLISHED, max_confidence, False


def callback_to_backend(s3_object_key, status, confidence_score):
    """バックエンドAPIにモデレーション結果をコールバックする。"""
    url = f"{BACKEND_API_URL}/api/v1/internal/moderation/callback"
    payload = json.dumps({
        "s3_object_key": s3_object_key,
        "status": status,
        "confidence_score": confidence_score,
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-API-Key": MODERATION_API_KEY,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("コールバック成功: status=%d", resp.status)
    except urllib.error.HTTPError as e:
        logger.error("コールバック失敗: status=%d, body=%s", e.code, e.read().decode())
        raise
    except urllib.error.URLError as e:
        logger.error("コールバック接続エラー: %s", e.reason)
        raise


def move_to_quarantine(bucket, object_key):
    """画像を隔離用プレフィックスに移動する。"""
    quarantined_key = f"{QUARANTINED_PREFIX}{object_key}"

    try:
        s3_client.copy_object(
            Bucket=bucket,
            CopySource={"Bucket": bucket, "Key": object_key},
            Key=quarantined_key,
        )
        s3_client.delete_object(Bucket=bucket, Key=object_key)
        logger.info("隔離完了: %s → %s", object_key, quarantined_key)
    except Exception:
        logger.exception("隔離処理でエラー: key=%s", object_key)
        raise


def send_slack_notification(object_key, confidence, is_csam, labels):
    """Slack通知を送信する。"""
    if not SLACK_WEBHOOK_URL:
        logger.info("Slack Webhook URLが未設定のためスキップ")
        return

    emoji = ":rotating_light:" if is_csam else ":warning:"
    title = "CSAM検知（緊急）" if is_csam else "コンテンツモデレーション検知"

    label_names = [f"{l['Name']} ({l['Confidence']:.1f}%)" for l in labels[:5]]
    label_text = "\n".join(label_names)

    payload = json.dumps({
        "text": f"{emoji} *{title}*\n"
                f"*対象:* `{object_key}`\n"
                f"*最大信頼度:* {confidence:.1f}%\n"
                f"*検出ラベル:*\n{label_text}",
    }).encode("utf-8")

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
