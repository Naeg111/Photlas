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

# モデレーションステータス（Issue#87: 数値コード）
STATUS_PUBLISHED = 1002
STATUS_QUARANTINED = 1003

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
# Rekognitionは L1/L2/L3 全階層のラベルを返すため、全階層を明示的に除外する
DEFAULT_EXCLUDED_LABELS = {
    # L1
    "Non-Explicit Nudity of Intimate parts and Kissing",
    "Drugs & Tobacco",
    "Alcohol",
    "Gambling",
    # L2
    "Non-Explicit Nudity", "Obstructed Intimate Parts", "Kissing on the Lips",
    "Swimwear or Underwear", "Weapons", "Products",
    "Drugs & Tobacco Paraphernalia & Use", "Alcohol Use", "Alcoholic Beverages",
    "Smoking",
    # L3
    "Bare Back", "Exposed Male Nipple", "Partially Exposed Buttocks",
    "Partially Exposed Female Breast", "Implied Nudity",
    "Obstructed Female Nipple", "Obstructed Male Genitalia",
    "Female Swimwear or Underwear", "Male Swimwear or Underwear",
    "Drinking", "Pills",
}


def extract_s3_records(event: dict) -> list:
    """イベントから S3 レコード一覧を取り出す。

    setup-s3-notifications.sh の構成変更により、Lambda は以下 2 種類の
    イベント形式を受け取る可能性がある:

    1. S3 から直接トリガーされた場合（後方互換）:
       { "Records": [{ "s3": { "bucket": ..., "object": ... } }] }

    2. S3 → SNS → Lambda の構成（新規）:
       { "Records": [{ "EventSource": "aws:sns",
                       "Sns": { "Message": "<S3 イベントの JSON 文字列>" } }] }

    本関数は両方のケースを正規化し、S3 レコードのリスト
    （`{"s3": {"bucket": ..., "object": ...}}` の形式）を返す。
    """
    s3_records = []
    for record in event.get("Records", []):
        if record.get("EventSource") == "aws:sns" or "Sns" in record:
            try:
                message = json.loads(record["Sns"]["Message"])
            except (KeyError, json.JSONDecodeError) as e:
                logger.warning("SNS メッセージのパースに失敗: %s", str(e))
                continue
            for inner in message.get("Records", []):
                if "s3" in inner:
                    s3_records.append(inner)
        elif "s3" in record:
            s3_records.append(record)
    return s3_records


def lambda_handler(event, context):
    """S3イベントをトリガーにRekognitionスキャンを実行する。

    SNS ファンアウト構成にも対応するため、イベントを extract_s3_records で
    正規化してから処理する。
    """
    for record in extract_s3_records(event):
        bucket = record["s3"]["bucket"]["name"]
        object_key = record["s3"]["object"]["key"]

        # 隔離プレフィックスのオブジェクトはスキップ
        if object_key.startswith("quarantined/"):
            logger.info("隔離プレフィックスのためスキップ: %s", object_key)
            continue

        logger.info("スキャン開始: bucket=%s, key=%s", bucket, object_key)

        try:
            result = scan_image(bucket, object_key)
            status, confidence, is_csam, detected_labels = evaluate_result(result)

            logger.info(
                "スキャン結果: key=%s, status=%s, confidence=%.2f, csam=%s",
                object_key, status, confidence, is_csam,
            )

            # バックエンドAPIにコールバック
            callback_to_backend(object_key, status, confidence, detected_labels)

            # QUARANTINED時の追加処理（S3移動はBackendが担当）
            if status == STATUS_QUARANTINED:
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
        tuple: (status, max_confidence, is_csam, filtered_label_names)
    """
    if not labels:
        return STATUS_PUBLISHED, 0.0, False, []

    # 除外ラベルをフィルタリング（環境変数 + デフォルト）
    all_excluded = EXCLUDED_LABELS | DEFAULT_EXCLUDED_LABELS
    filtered = [l for l in labels if l["Name"] not in all_excluded]

    if not filtered:
        return STATUS_PUBLISHED, 0.0, False, []

    max_confidence = max(label["Confidence"] for label in filtered)
    is_csam = any(label["Name"] in CSAM_LABELS for label in filtered)
    filtered_label_names = [l["Name"] for l in filtered]

    if max_confidence >= CONFIDENCE_THRESHOLD:
        return STATUS_QUARANTINED, max_confidence, is_csam, filtered_label_names

    return STATUS_PUBLISHED, max_confidence, False, filtered_label_names


def callback_to_backend(s3_object_key, status, confidence_score, detected_labels=None):
    """バックエンドAPIにモデレーション結果をコールバックする。"""
    url = f"{BACKEND_API_URL}/api/v1/internal/moderation/callback"
    body = {
        "s3_object_key": s3_object_key,
        "status": status,
        "confidence_score": confidence_score,
    }
    if detected_labels:
        body["detected_labels"] = detected_labels
    payload = json.dumps(body).encode("utf-8")

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
