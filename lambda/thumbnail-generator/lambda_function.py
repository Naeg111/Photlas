"""
Issue#75: サムネイル生成Lambda関数
Issue#100: タグベース孤立ファイル対応（元画像タグのコピー + 二重チェック方式）
SNS ファンアウト対応: S3 → SNS Topic → 複数 Lambda の構成に対応

S3にアップロードされた写真から中央クロップで正方形サムネイル（400x400 WebP）を
生成し、thumbnails/ プレフィックス配下に保存する。

Issue#100 対応として、元画像の status タグをサムネイルにコピーする。
書き込み後にもう一度元画像のタグを確認し、書き込み中にメタデータ登録（ステップ3）
が完了して registered に変わっていた場合はサムネイルのタグも追従させる
（race condition への二重チェック対策）。
"""

import io
import json
import logging
import urllib.parse

import boto3
from PIL import Image

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")

THUMBNAIL_MAX_SIZE = 400
THUMBNAIL_QUALITY = 80
THUMBNAIL_PREFIX = "thumbnails/"
UPLOADS_PREFIX = "uploads/"

# Issue#100: タグ定数（バックエンド S3Service / フロントエンド apiClient.ts と値を揃える）
STATUS_TAG_KEY = "status"
STATUS_TAG_VALUE_PENDING = "pending"
STATUS_TAG_VALUE_REGISTERED = "registered"


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
            # SNS 経由: Sns.Message に S3 イベント全体が JSON 文字列で入っている
            try:
                message = json.loads(record["Sns"]["Message"])
            except (KeyError, json.JSONDecodeError) as e:
                logger.warning("SNS メッセージのパースに失敗: %s", str(e))
                continue
            for inner in message.get("Records", []):
                if "s3" in inner:
                    s3_records.append(inner)
        elif "s3" in record:
            # S3 から直接: そのまま使う
            s3_records.append(record)
    return s3_records


def generate_thumbnail_key(s3_key: str) -> str:
    """元画像のS3キーからサムネイルのS3キーを生成する。

    Args:
        s3_key: 元画像のS3オブジェクトキー

    Returns:
        サムネイルのS3オブジェクトキー（拡張子は.webp）
    """
    base_name = s3_key.rsplit(".", 1)[0]
    return f"{THUMBNAIL_PREFIX}{base_name}.webp"


def should_process(s3_key: str) -> bool:
    """処理対象のキーかどうかを判定する。

    Args:
        s3_key: S3オブジェクトキー

    Returns:
        処理対象の場合True
    """
    return s3_key.startswith(UPLOADS_PREFIX)


def center_crop_and_resize(image: Image.Image) -> Image.Image:
    """画像を中央正方形クロップし、400x400にリサイズする。

    Args:
        image: 元画像（PIL Image）

    Returns:
        400x400にリサイズされた正方形画像
    """
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    width, height = image.size
    min_dim = min(width, height)
    left = (width - min_dim) // 2
    top = (height - min_dim) // 2
    image = image.crop((left, top, left + min_dim, top + min_dim))

    return image.resize(
        (THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE), Image.LANCZOS
    )


def get_status_tag_value(bucket: str, key: str) -> str | None:
    """Issue#100: 指定 S3 オブジェクトの status タグ値を返す。

    タグが存在しない場合は None を返す。
    """
    try:
        response = s3_client.get_object_tagging(Bucket=bucket, Key=key)
        for tag in response.get("TagSet", []):
            if tag.get("Key") == STATUS_TAG_KEY:
                return tag.get("Value")
        return None
    except Exception as e:
        logger.warning("get_object_tagging failed for %s: %s", key, str(e))
        return None


def set_status_tag(bucket: str, key: str, value: str) -> None:
    """Issue#100: 指定 S3 オブジェクトの status タグを設定する。"""
    s3_client.put_object_tagging(
        Bucket=bucket,
        Key=key,
        Tagging={"TagSet": [{"Key": STATUS_TAG_KEY, "Value": value}]},
    )


def lambda_handler(event, context):
    """Lambda関数ハンドラー。

    S3 PutObjectイベントを受け取り、サムネイルを生成する。
    Issue#100: 元画像の status タグをサムネイルにコピーし、書き込み後に
    元画像のタグが変わっていれば追従更新する。
    """
    for record in extract_s3_records(event):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        if not should_process(key):
            logger.info("Skipping non-upload key: %s", key)
            continue

        try:
            logger.info("Generating thumbnail for: %s/%s", bucket, key)

            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_data = response["Body"].read()

            image = Image.open(io.BytesIO(image_data))
            image = center_crop_and_resize(image)

            output = io.BytesIO()
            image.save(output, format="WEBP", quality=THUMBNAIL_QUALITY)
            output.seek(0)

            # Issue#100: サムネイル書き込み直前に元画像のタグを取得
            # （書き込み直前に取得することで race window を最小化）
            source_status_before = get_status_tag_value(bucket, key)

            thumbnail_key = generate_thumbnail_key(key)
            put_kwargs = {
                "Bucket": bucket,
                "Key": thumbnail_key,
                "Body": output.getvalue(),
                "ContentType": "image/webp",
            }
            # 元画像のタグが取得できた場合のみサムネイルにコピー
            if source_status_before is not None:
                put_kwargs["Tagging"] = f"{STATUS_TAG_KEY}={source_status_before}"

            s3_client.put_object(**put_kwargs)

            logger.info("Thumbnail generated: %s/%s (tag=%s)",
                        bucket, thumbnail_key, source_status_before)

            # Issue#100: 二重チェック - 書き込み中にメタデータ登録が完了して
            # 元画像のタグが registered に変わっていた場合、サムネイルのタグも追従
            source_status_after = get_status_tag_value(bucket, key)
            if (source_status_after is not None
                    and source_status_after != source_status_before):
                logger.info("Source tag changed during thumbnail write "
                            "(%s -> %s), updating thumbnail tag",
                            source_status_before, source_status_after)
                set_status_tag(bucket, thumbnail_key, source_status_after)

        except Exception as e:
            # サムネイル生成失敗は写真の公開に影響しない
            logger.error("Failed to generate thumbnail for %s: %s", key, str(e))

    return {"statusCode": 200, "body": "OK"}
