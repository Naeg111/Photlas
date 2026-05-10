"""
Issue#75: サムネイル生成Lambda関数
Issue#100: タグベース孤立ファイル対応（元画像タグのコピー + 二重チェック方式）
Issue#123: Retina 対応として 800x800 化 + アンシャープマスク適用
Issue#125: LQIP（低品質プレースホルダー）生成 + バックエンド内部 API へのコールバック
SNS ファンアウト対応: S3 → SNS Topic → 複数 Lambda の構成に対応

S3にアップロードされた写真から中央クロップで正方形サムネイル（800x800 WebP）を
生成し、thumbnails/ プレフィックス配下に保存する。

Issue#100 対応として、元画像の status タグをサムネイルにコピーする。
書き込み後にもう一度元画像のタグを確認し、書き込み中にメタデータ登録（ステップ3）
が完了して registered に変わっていた場合はサムネイルのタグも追従させる
（race condition への二重チェック対策）。

Issue#125 対応として、サムネイル生成と同時に 20x20 px の WebP（base64 化した
data URL、~800 byte）を生成し、バックエンドの内部 API にコールバックして
DB に保存する。コールバック失敗時は指数バックオフで最大 3 回リトライし、
最終失敗時はサムネイル生成自体は成功扱いとする。
"""

import base64
import io
import json
import logging
import os
import time
import urllib.parse
import urllib.request

import boto3
from PIL import Image, ImageFilter

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")

THUMBNAIL_MAX_SIZE = 800
THUMBNAIL_QUALITY = 85
THUMBNAIL_PREFIX = "thumbnails/"
UPLOADS_PREFIX = "uploads/"

# Issue#123: アンシャープマスクのパラメータ（Pillow デフォルト値を初期値に採用）
# 実物確認の結果でチューニングする想定のため、この定数値を変えて再デプロイで対応する
UNSHARP_MASK_RADIUS = 2       # 強調するエッジの太さ（px）
UNSHARP_MASK_PERCENT = 150    # 強調の強度（%）
UNSHARP_MASK_THRESHOLD = 3    # この値以下のコントラスト差は無視（ノイズ抑制）

# Issue#100: タグ定数（バックエンド S3Service / フロントエンド apiClient.ts と値を揃える）
STATUS_TAG_KEY = "status"
STATUS_TAG_VALUE_PENDING = "pending"
STATUS_TAG_VALUE_REGISTERED = "registered"

# Issue#124: 写真画像の Cache-Control を immutable 化（バックエンド S3Service /
# フロントエンド apiClient.ts と値を揃える。変更時は 3 箇所同時に変える）
S3_CACHE_CONTROL_VALUE = "public, max-age=31536000, immutable"

# Issue#125: LQIP（低品質プレースホルダー）の生成パラメータ
LQIP_SIZE = 20
LQIP_QUALITY = 30

# Issue#125: バックエンド内部 API へのコールバック設定
# 環境変数 BACKEND_URL が未設定の場合（ローカルテスト時等）はコールバックを諦める
LQIP_BACKEND_URL_ENV = "BACKEND_URL"
LQIP_API_KEY_ENV = "MODERATION_API_KEY"
LQIP_CALLBACK_PATH = "/api/v1/internal/photos/lqip"
LQIP_CALLBACK_TIMEOUT = 10
# 指数バックオフ: 1s → 3s → 9s（合計 13s + リクエスト時間）
LQIP_CALLBACK_RETRY_DELAYS = (1, 3, 9)


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


def calculate_user_specified_crop_box(
    width: int, height: int, cx: float, cy: float, zoom: float
) -> tuple[float, float, float, float]:
    """Issue#131: ユーザー指定範囲のクロップ box (left, top, right, bottom) を計算する。

    cx, cy: 0.0〜1.0 の正規化座標（画像内の中心位置）
    zoom:   1.0〜3.0 のズーム倍率
    クロップする正方形の一辺は「画像短辺 / zoom」。中心が画像端に近い場合は
    画像境界からはみ出さないよう左上座標を補正（クランプ）する。
    """
    short_side = min(width, height)
    side = short_side / zoom

    center_x = cx * width
    center_y = cy * height

    left = center_x - side / 2
    top = center_y - side / 2

    # 画像境界からはみ出ないようクランプ
    left = max(0.0, min(left, width - side))
    top = max(0.0, min(top, height - side))

    return (left, top, left + side, top + side)


# Issue#131: ユーザー指定範囲の crop 値域
CROP_CENTER_MIN = 0.0
CROP_CENTER_MAX = 1.0
CROP_ZOOM_MIN = 1.0
CROP_ZOOM_MAX = 3.0

# Issue#131: S3 オブジェクトメタデータのキー（"x-amz-meta-" は除いた小文字キー）
# バックエンド S3Service.java とフロントエンド apiClient.ts と値を揃える
# （変更時は 3 箇所同時に変えること）
S3_METADATA_KEY_CROP_CENTER_X = "crop-center-x"
S3_METADATA_KEY_CROP_CENTER_Y = "crop-center-y"
S3_METADATA_KEY_CROP_ZOOM = "crop-zoom"


def parse_crop_metadata(metadata: dict) -> tuple[float, float, float] | None:
    """Issue#131: S3 Metadata から (cx, cy, zoom) を取り出す。

    キーが揃っていて、float としてパースでき、値域内の場合のみ tuple を返す。
    そうでない場合は None を返し、呼び出し側で中央クロップにフォールバックする。

    Lambda が受け取る metadata のキーは小文字に正規化済み:
    - crop-center-x: 0.0〜1.0 の文字列
    - crop-center-y: 0.0〜1.0 の文字列
    - crop-zoom:     1.0〜3.0 の文字列
    """
    cx_str = metadata.get(S3_METADATA_KEY_CROP_CENTER_X)
    cy_str = metadata.get(S3_METADATA_KEY_CROP_CENTER_Y)
    zoom_str = metadata.get(S3_METADATA_KEY_CROP_ZOOM)

    if cx_str is None or cy_str is None or zoom_str is None:
        return None

    try:
        cx = float(cx_str)
        cy = float(cy_str)
        zoom = float(zoom_str)
    except (TypeError, ValueError):
        return None

    if not (CROP_CENTER_MIN <= cx <= CROP_CENTER_MAX):
        return None
    if not (CROP_CENTER_MIN <= cy <= CROP_CENTER_MAX):
        return None
    if not (CROP_ZOOM_MIN <= zoom <= CROP_ZOOM_MAX):
        return None

    return (cx, cy, zoom)


def center_crop_and_resize(
    image: Image.Image,
    crop: tuple[float, float, float] | None = None,
) -> Image.Image:
    """画像を正方形クロップし、800x800にリサイズしてアンシャープマスクをかける。

    Issue#123: Retina ディスプレイで CSS 200〜400 px の枠でも輪郭がくっきり
    見えるよう、解像度を 400→800 に倍化。リサイズ後はアンシャープマスクで
    エッジ強調する（threshold で平坦部のノイズには手を入れない）。

    Issue#131: crop 引数（cx, cy, zoom）が渡された場合は、ユーザー指定範囲で
    クロップする。None の場合は従来通り中央クロップにフォールバック。

    Args:
        image: 元画像（PIL Image）
        crop:  ユーザー指定範囲 (cx, cy, zoom) または None（中央クロップ）

    Returns:
        800x800にリサイズ + アンシャープマスク適用後の正方形画像
    """
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")

    width, height = image.size
    if crop is not None:
        cx, cy, zoom = crop
        box = calculate_user_specified_crop_box(width, height, cx, cy, zoom)
    else:
        min_dim = min(width, height)
        left = (width - min_dim) // 2
        top = (height - min_dim) // 2
        box = (left, top, left + min_dim, top + min_dim)
    image = image.crop(box)

    image = image.resize(
        (THUMBNAIL_MAX_SIZE, THUMBNAIL_MAX_SIZE), Image.LANCZOS
    )
    return image.filter(
        ImageFilter.UnsharpMask(
            radius=UNSHARP_MASK_RADIUS,
            percent=UNSHARP_MASK_PERCENT,
            threshold=UNSHARP_MASK_THRESHOLD,
        )
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


def generate_lqip(image: Image.Image) -> bytes:
    """Issue#125: 元画像から LQIP（低品質プレースホルダー）の WebP バイト列を生成する。

    20x20 px に縮小し、quality=30 で WebP エンコードする。実測で 200〜600 byte 程度。
    入力 image オブジェクトは破壊しない（copy してから加工する）。
    """
    lqip = image.copy()
    lqip.thumbnail((LQIP_SIZE, LQIP_SIZE), Image.LANCZOS)
    if lqip.mode in ("RGBA", "P"):
        lqip = lqip.convert("RGB")
    buf = io.BytesIO()
    lqip.save(buf, format="WEBP", quality=LQIP_QUALITY)
    return buf.getvalue()


def post_lqip_to_backend(s3_object_key: str, lqip_data_url: str) -> bool:
    """Issue#125: バックエンド内部 API に LQIP コールバックを POST する。

    指数バックオフで最大 3 回リトライする（LQIP_CALLBACK_RETRY_DELAYS 参照）。
    すべて失敗した場合は False を返す（例外は伝播しない）。

    呼び出し側はこの関数の戻り値を見て、コールバック失敗を許容する設計とする。
    LQIP は無くてもフロントが従来挙動にフォールバックするため、致命的ではない。
    """
    backend_url = os.environ.get(LQIP_BACKEND_URL_ENV)
    api_key = os.environ.get(LQIP_API_KEY_ENV)
    if not backend_url or not api_key:
        logger.warning(
            "LQIP callback skipped: %s or %s not set",
            LQIP_BACKEND_URL_ENV, LQIP_API_KEY_ENV,
        )
        return False

    url = backend_url.rstrip("/") + LQIP_CALLBACK_PATH
    body = json.dumps({
        "s3_object_key": s3_object_key,
        "lqip_data_url": lqip_data_url,
    }).encode("utf-8")
    headers = {"Content-Type": "application/json", "X-API-Key": api_key}

    last_attempt = len(LQIP_CALLBACK_RETRY_DELAYS) - 1
    for attempt, delay in enumerate(LQIP_CALLBACK_RETRY_DELAYS):
        try:
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=LQIP_CALLBACK_TIMEOUT) as resp:
                if 200 <= resp.status < 300:
                    return True
                logger.warning(
                    "LQIP callback non-2xx response: status=%d attempt=%d",
                    resp.status, attempt + 1,
                )
        except Exception as e:
            logger.warning(
                "LQIP callback attempt %d failed: %s", attempt + 1, str(e),
            )
        # 最後の試行後は sleep しない（無駄な待機を避ける）
        if attempt < last_attempt:
            time.sleep(delay)

    logger.error(
        "LQIP callback gave up after %d retries: key=%s",
        len(LQIP_CALLBACK_RETRY_DELAYS), s3_object_key,
    )
    return False


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

            # Issue#131: ユーザー指定範囲のクロップを S3 Metadata から取得。
            # 無い・不正な値の場合は中央クロップにフォールバックする。
            metadata = response.get("Metadata", {})
            crop = parse_crop_metadata(metadata)
            if crop is not None:
                logger.info(
                    "Using user-specified crop: cx=%.4f, cy=%.4f, zoom=%.4f",
                    crop[0], crop[1], crop[2],
                )
            else:
                logger.info(
                    "No valid crop metadata, falling back to center crop "
                    "(metadata=%s)", metadata,
                )

            image = Image.open(io.BytesIO(image_data))
            image = center_crop_and_resize(image, crop=crop)

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
                "CacheControl": S3_CACHE_CONTROL_VALUE,
            }
            # 元画像のタグが取得できた場合のみサムネイルにコピー
            if source_status_before is not None:
                put_kwargs["Tagging"] = f"{STATUS_TAG_KEY}={source_status_before}"

            s3_client.put_object(**put_kwargs)

            logger.info("Thumbnail generated: %s/%s (tag=%s)",
                        bucket, thumbnail_key, source_status_before)

            # Issue#125: LQIP 生成 + バックエンド内部 API へのコールバック。
            # サムネ書き込み成功後に行い、コールバック失敗は致命的にしない
            # （LQIP 無しでもフロントは従来挙動にフォールバックするため）。
            try:
                lqip_bytes = generate_lqip(image)
                lqip_b64 = base64.b64encode(lqip_bytes).decode("ascii")
                lqip_data_url = f"data:image/webp;base64,{lqip_b64}"
                post_lqip_to_backend(key, lqip_data_url)
            except Exception as e:
                logger.warning("LQIP generation failed (non-fatal): %s", str(e))

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
