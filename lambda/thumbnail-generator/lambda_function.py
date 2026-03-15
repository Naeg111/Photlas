"""
Issue#59: サムネイル生成Lambda関数

S3にアップロードされた写真からサムネイル（400x400 WebP）を生成し、
thumbnails/ プレフィックス配下に保存する。
"""

import io
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


def lambda_handler(event, context):
    """Lambda関数ハンドラー。

    S3 PutObjectイベントを受け取り、サムネイルを生成する。
    """
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        if not should_process(key):
            logger.info("Skipping non-upload key: %s", key)
            continue

        try:
            logger.info("Generating thumbnail for: %s/%s", bucket, key)

            # 元画像をS3からダウンロード
            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_data = response["Body"].read()

            # Pillowで画像を開いてリサイズ
            image = Image.open(io.BytesIO(image_data))

            # RGBA（透過）の場合はRGBに変換（WebP保存時に必要）
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")

            # アスペクト比維持でリサイズ（長辺を400pxに）
            image.thumbnail((THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE), Image.LANCZOS)

            # WebP形式で保存
            output = io.BytesIO()
            image.save(output, format="WEBP", quality=THUMBNAIL_QUALITY)
            output.seek(0)

            # サムネイルをS3にアップロード
            thumbnail_key = generate_thumbnail_key(key)
            s3_client.put_object(
                Bucket=bucket,
                Key=thumbnail_key,
                Body=output.getvalue(),
                ContentType="image/webp",
            )

            logger.info("Thumbnail generated: %s/%s", bucket, thumbnail_key)

        except Exception as e:
            # サムネイル生成失敗は写真の公開に影響しない
            logger.error("Failed to generate thumbnail for %s: %s", key, str(e))

    return {"statusCode": 200, "body": "OK"}
