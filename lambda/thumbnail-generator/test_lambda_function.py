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
        """横長画像が400x400の正方形にクロップ+リサイズされる。"""
        img = Image.new("RGB", (800, 600))
        result = center_crop_and_resize(img)
        assert result.size == (400, 400)

    def test_portrait_image(self):
        """縦長画像が400x400の正方形にクロップ+リサイズされる。"""
        img = Image.new("RGB", (600, 800))
        result = center_crop_and_resize(img)
        assert result.size == (400, 400)

    def test_square_image(self):
        """正方形画像が400x400にリサイズされる。"""
        img = Image.new("RGB", (1000, 1000))
        result = center_crop_and_resize(img)
        assert result.size == (400, 400)

    def test_rgba_converted_to_rgb(self):
        """RGBA画像がRGBに変換される。"""
        img = Image.new("RGBA", (800, 600))
        result = center_crop_and_resize(img)
        assert result.mode == "RGB"
        assert result.size == (400, 400)


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
    def test_thumbnail_is_400x400_square(self, mock_s3):
        """Issue#75 - 横長画像から400x400の正方形サムネイルが生成される。"""
        jpeg_bytes = create_test_image(800, 600, color="blue")
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        result_img = Image.open(io.BytesIO(captured["data"]))
        assert result_img.size == (400, 400), (
            f"サムネイルは400x400であるべきですが、{result_img.size}でした"
        )

    @patch("lambda_function.s3_client")
    def test_thumbnail_is_400x400_from_portrait(self, mock_s3):
        """Issue#75 - 縦長画像から400x400の正方形サムネイルが生成される。"""
        jpeg_bytes = create_test_image(600, 800, color="green")
        captured = setup_mock_s3_with_capture(mock_s3, jpeg_bytes)

        lambda_handler(create_s3_event("uploads/1/portrait.jpg"), None)

        result_img = Image.open(io.BytesIO(captured["data"]))
        assert result_img.size == (400, 400), (
            f"サムネイルは400x400であるべきですが、{result_img.size}でした"
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
