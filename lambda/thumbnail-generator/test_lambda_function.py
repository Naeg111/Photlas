"""
Issue#75: サムネイル生成Lambda関数のユニットテスト

テスト実行: cd lambda/thumbnail-generator && python3 -m pytest test_lambda_function.py -v
"""

import io
from unittest.mock import patch, MagicMock

from PIL import Image

from lambda_function import (
    center_crop_and_resize,
    lambda_handler,
    generate_thumbnail_key,
    should_process,
    STATUS_TAG_KEY,
    STATUS_TAG_VALUE_PENDING,
    STATUS_TAG_VALUE_REGISTERED,
    UNSHARP_MASK_RADIUS,
    UNSHARP_MASK_PERCENT,
    UNSHARP_MASK_THRESHOLD,
)

TEST_BUCKET = "photlas-uploads-test"


def create_test_image(width, height, color="red", fmt="JPEG"):
    """テスト用のJPEG画像バイト列を生成する。"""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def create_s3_event(key, bucket=TEST_BUCKET):
    """S3 PUTイベントを生成する。"""
    return {
        "Records": [{
            "s3": {
                "bucket": {"name": bucket},
                "object": {"key": key}
            }
        }]
    }


def setup_mock_s3_with_capture(mock_s3, image_bytes):
    """S3モックを設定し、put_objectの内容をキャプチャする。"""
    mock_s3.get_object.return_value = {
        "Body": MagicMock(read=MagicMock(return_value=image_bytes))
    }
    captured = {}

    def capture_put(**kwargs):
        captured["data"] = kwargs["Body"]
        return {}

    mock_s3.put_object.side_effect = capture_put
    return captured


class TestGenerateThumbnailKey:
    """サムネイルS3キー生成のテスト。"""

    def test_jpg_to_webp(self):
        """JPEGファイルのキーがWebPサムネイルキーに変換される。"""
        result = generate_thumbnail_key("uploads/1/abc123.jpg")
        assert result == "thumbnails/uploads/1/abc123.webp"

    def test_png_to_webp(self):
        """PNGファイルのキーがWebPサムネイルキーに変換される。"""
        result = generate_thumbnail_key("uploads/1/abc123.png")
        assert result == "thumbnails/uploads/1/abc123.webp"

    def test_heic_to_webp(self):
        """HEICファイルのキーがWebPサムネイルキーに変換される。"""
        result = generate_thumbnail_key("uploads/1/abc123.heic")
        assert result == "thumbnails/uploads/1/abc123.webp"

    def test_jpeg_to_webp(self):
        """JPEG拡張子のキーがWebPサムネイルキーに変換される。"""
        result = generate_thumbnail_key("uploads/1/abc123.jpeg")
        assert result == "thumbnails/uploads/1/abc123.webp"

    def test_webp_to_webp(self):
        """WebPファイルのキーがWebPサムネイルキーに変換される。"""
        result = generate_thumbnail_key("uploads/1/abc123.webp")
        assert result == "thumbnails/uploads/1/abc123.webp"


class TestShouldProcess:
    """処理対象判定のテスト。"""

    def test_uploads_prefix(self):
        """uploads/プレフィックスのキーは処理対象。"""
        assert should_process("uploads/1/abc123.jpg") is True

    def test_thumbnails_prefix_skipped(self):
        """thumbnails/プレフィックスのキーは処理対象外（無限ループ防止）。"""
        assert should_process("thumbnails/uploads/1/abc123.webp") is False

    def test_avatars_prefix_skipped(self):
        """avatars/プレフィックスのキーは処理対象外。"""
        assert should_process("avatars/1/abc123.jpg") is False

    def test_quarantined_prefix_skipped(self):
        """quarantined/プレフィックスのキーは処理対象外。"""
        assert should_process("quarantined/uploads/1/abc123.jpg") is False


class TestCenterCropAndResize:
    """中央クロップ+リサイズのテスト。"""

    def test_landscape_image(self):
        """Issue#123 - 横長画像が800x800の正方形にクロップ+リサイズされる。"""
        img = Image.new("RGB", (1600, 1200))
        result = center_crop_and_resize(img)
        assert result.size == (800, 800)

    def test_portrait_image(self):
        """Issue#123 - 縦長画像が800x800の正方形にクロップ+リサイズされる。"""
        img = Image.new("RGB", (1200, 1600))
        result = center_crop_and_resize(img)
        assert result.size == (800, 800)

    def test_square_image(self):
        """Issue#123 - 正方形画像が800x800にリサイズされる。"""
        img = Image.new("RGB", (1000, 1000))
        result = center_crop_and_resize(img)
        assert result.size == (800, 800)

    def test_rgba_converted_to_rgb(self):
        """Issue#123 - RGBA画像がRGBに変換され、800x800になる。"""
        img = Image.new("RGBA", (1600, 1200))
        result = center_crop_and_resize(img)
        assert result.mode == "RGB"
        assert result.size == (800, 800)


class TestLambdaHandler:
    """Lambda関数ハンドラーのテスト。"""

    @patch("lambda_function.s3_client")
    def test_successful_thumbnail_generation(self, mock_s3):
        """正常にサムネイルが生成される。"""
        jpeg_bytes = create_test_image(800, 600)

        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.put_object.return_value = {}

        result = lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        assert result["statusCode"] == 200
        mock_s3.put_object.assert_called_once()
        call_args = mock_s3.put_object.call_args
        assert call_args[1]["Key"] == "thumbnails/uploads/1/test.webp"
        assert call_args[1]["ContentType"] == "image/webp"

    @patch("lambda_function.s3_client")
    def test_thumbnail_is_800x800_square(self, mock_s3):
        """Issue#123 - 横長画像から800x800の正方形サムネイルが生成される。"""
        jpeg_bytes = create_test_image(1600, 1200, color="blue")
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        result_img = Image.open(io.BytesIO(captured["data"]))
        assert result_img.size == (800, 800), (
            f"サムネイルは800x800であるべきですが、{result_img.size}でした"
        )

    @patch("lambda_function.s3_client")
    def test_thumbnail_is_800x800_from_portrait(self, mock_s3):
        """Issue#123 - 縦長画像から800x800の正方形サムネイルが生成される。"""
        jpeg_bytes = create_test_image(1200, 1600, color="green")
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/portrait.jpg"), None)

        result_img = Image.open(io.BytesIO(captured["data"]))
        assert result_img.size == (800, 800), (
            f"サムネイルは800x800であるべきですが、{result_img.size}でした"
        )

    @patch("lambda_function.s3_client")
    def test_thumbnail_format_is_webp(self, mock_s3):
        """Issue#75 - 生成されたサムネイルがWebPフォーマットである。"""
        jpeg_bytes = create_test_image(800, 600)
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        result_img = Image.open(io.BytesIO(captured["data"]))
        assert result_img.format == "WEBP", (
            f"サムネイルはWebPであるべきですが、{result_img.format}でした"
        )

    @patch("lambda_function.s3_client")
    def test_skip_thumbnails_prefix(self, mock_s3):
        """thumbnails/プレフィックスのイベントはスキップされる。"""
        result = lambda_handler(
            create_s3_event("thumbnails/uploads/1/test.webp"), None
        )

        assert result["statusCode"] == 200
        mock_s3.get_object.assert_not_called()


class TestIssue100TagConstants:
    """Issue#100 - タグ定数の定義。"""

    def test_status_tag_key(self):
        """STATUS_TAG_KEY が "status" として定義されている。"""
        assert STATUS_TAG_KEY == "status"

    def test_status_tag_value_pending(self):
        """STATUS_TAG_VALUE_PENDING が "pending" として定義されている。"""
        assert STATUS_TAG_VALUE_PENDING == "pending"

    def test_status_tag_value_registered(self):
        """STATUS_TAG_VALUE_REGISTERED が "registered" として定義されている。"""
        assert STATUS_TAG_VALUE_REGISTERED == "registered"


class TestIssue100TagCopy:
    """Issue#100 - 元画像のタグをサムネイルに付与するテスト。"""

    @patch("lambda_function.s3_client")
    def test_thumbnail_inherits_pending_tag_from_source(self, mock_s3):
        """元画像のタグが pending の場合、サムネイルにも pending タグが付与される。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        # get_object_tagging: 1回目は元画像 pending、2回目（二重チェック）も pending
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "pending"}]
        }
        mock_s3.put_object.return_value = {}

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        # put_object 呼び出し時に Tagging="status=pending" が含まれること
        call_args = mock_s3.put_object.call_args
        assert call_args[1].get("Tagging") == "status=pending"

    @patch("lambda_function.s3_client")
    def test_thumbnail_inherits_registered_tag_from_source(self, mock_s3):
        """元画像のタグが registered の場合、サムネイルにも registered タグが付与される。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "registered"}]
        }
        mock_s3.put_object.return_value = {}

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        call_args = mock_s3.put_object.call_args
        assert call_args[1].get("Tagging") == "status=registered"


class TestIssue100DoubleCheck:
    """Issue#100 - サムネイル書き込み後の二重チェックのテスト。"""

    @patch("lambda_function.s3_client")
    def test_double_check_updates_thumbnail_tag_when_source_changed(self, mock_s3):
        """元画像のタグが書き込み中に変わった場合、サムネイルのタグを更新する。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        # get_object_tagging を順次返す: 1回目は pending、2回目（二重チェック）は registered
        mock_s3.get_object_tagging.side_effect = [
            {"TagSet": [{"Key": "status", "Value": "pending"}]},      # 1回目: 書き込み前
            {"TagSet": [{"Key": "status", "Value": "registered"}]},   # 2回目: 書き込み後（変化）
        ]
        mock_s3.put_object.return_value = {}
        mock_s3.put_object_tagging.return_value = {}

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        # 二重チェック後、サムネイルのタグを registered に更新する put_object_tagging が呼ばれる
        mock_s3.put_object_tagging.assert_called_once()
        call_args = mock_s3.put_object_tagging.call_args
        assert call_args[1]["Key"] == "thumbnails/uploads/1/test.webp"
        tag_set = call_args[1]["Tagging"]["TagSet"]
        assert {"Key": "status", "Value": "registered"} in tag_set

    @patch("lambda_function.s3_client")
    def test_double_check_does_not_update_when_source_unchanged(self, mock_s3):
        """元画像のタグが変わっていない場合、サムネイルのタグ更新は呼ばれない。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "pending"}]
        }
        mock_s3.put_object.return_value = {}
        mock_s3.put_object_tagging.return_value = {}

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        # 二重チェックでタグ変化がないので put_object_tagging は呼ばれない
        mock_s3.put_object_tagging.assert_not_called()


def create_sns_wrapped_s3_event(key, bucket=TEST_BUCKET):
    """S3 イベントを SNS でラップした Lambda イベントを生成する。

    setup-s3-notifications.sh の修正で S3 → SNS → Lambda となった場合の
    Lambda が受け取るイベント形式。
    """
    import json as _json
    s3_event = create_s3_event(key, bucket)
    return {
        "Records": [{
            "EventSource": "aws:sns",
            "EventVersion": "1.0",
            "EventSubscriptionArn": "arn:aws:sns:ap-northeast-1:111111111111:photlas-s3-uploads-test:dummy-sub",
            "Sns": {
                "Type": "Notification",
                "MessageId": "dummy-message-id",
                "TopicArn": "arn:aws:sns:ap-northeast-1:111111111111:photlas-s3-uploads-test",
                "Subject": "Amazon S3 Notification",
                "Message": _json.dumps(s3_event),
                "Timestamp": "2026-05-01T00:00:00.000Z",
            }
        }]
    }


class TestSnsWrappedEvent:
    """SNS ファンアウト経由でイベントを受け取った場合のテスト。

    setup-s3-notifications.sh の修正で S3 → SNS → 複数 Lambda の構成にした際、
    Lambda が SNS でラップされたイベントを受け取れるよう正規化する必要がある。
    """

    @patch("lambda_function.s3_client")
    def test_sns_wrapped_event_processed_correctly(self, mock_s3):
        """SNS ラッパー経由の S3 イベントでも、サムネイルが生成される。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "pending"}]
        }
        mock_s3.put_object.return_value = {}

        result = lambda_handler(
            create_sns_wrapped_s3_event("uploads/1/test.jpg"), None
        )

        assert result["statusCode"] == 200
        # サムネイル生成のための put_object が呼ばれていること
        mock_s3.put_object.assert_called_once()
        call_args = mock_s3.put_object.call_args
        assert call_args[1]["Key"] == "thumbnails/uploads/1/test.webp"

    @patch("lambda_function.s3_client")
    def test_direct_s3_event_still_works(self, mock_s3):
        """直接の S3 イベント（後方互換）も従来どおり処理される。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "pending"}]
        }
        mock_s3.put_object.return_value = {}

        result = lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        assert result["statusCode"] == 200
        mock_s3.put_object.assert_called_once()


class TestIssue123UnsharpMask:
    """Issue#123 - リサイズ後にアンシャープマスクが適用されるテスト。"""

    @patch("lambda_function.s3_client")
    @patch("lambda_function.ImageFilter")
    def test_unsharp_mask_called_with_configured_params(self, mock_image_filter, mock_s3):
        """center_crop_and_resize の中で ImageFilter.UnsharpMask が
        モジュール定数で設定された値で呼ばれる。
        """
        from PIL import ImageFilter as RealImageFilter

        # mock した ImageFilter.UnsharpMask は実際の UnsharpMask を返すようにし、
        # Image.filter() が動作するようにする
        mock_image_filter.UnsharpMask.return_value = RealImageFilter.UnsharpMask(
            radius=UNSHARP_MASK_RADIUS,
            percent=UNSHARP_MASK_PERCENT,
            threshold=UNSHARP_MASK_THRESHOLD,
        )

        jpeg_bytes = create_test_image(1600, 1200)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.get_object_tagging.return_value = {
            "TagSet": [{"Key": "status", "Value": "pending"}]
        }
        mock_s3.put_object.return_value = {}

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        mock_image_filter.UnsharpMask.assert_called_once_with(
            radius=UNSHARP_MASK_RADIUS,
            percent=UNSHARP_MASK_PERCENT,
            threshold=UNSHARP_MASK_THRESHOLD,
        )


class TestIssue123FileSizeLimit:
    """Issue#123 - 生成サムネイルのファイルサイズ上限テスト。

    800x800 化で 1 枚あたり 30KB → 100〜130KB 程度になる見込み。
    余裕を見て 200KB を上限とする（CDN コスト・ストレージへの影響を抑える保証線）。
    """

    MAX_THUMBNAIL_BYTES = 200 * 1024  # 200KB

    @patch("lambda_function.s3_client")
    def test_thumbnail_size_does_not_exceed_limit(self, mock_s3):
        """生成されたサムネイルが 200KB を超えない。"""
        jpeg_bytes = create_test_image(1600, 1200, color="red")
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        size_bytes = len(captured["data"])
        assert size_bytes <= self.MAX_THUMBNAIL_BYTES, (
            f"サムネイルは {self.MAX_THUMBNAIL_BYTES} バイト以下であるべきですが、"
            f"{size_bytes} バイトでした"
        )
