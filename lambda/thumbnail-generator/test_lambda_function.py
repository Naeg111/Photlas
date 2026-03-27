"""
Issue#59: サムネイル生成Lambda関数のユニットテスト

テスト実行: cd lambda/thumbnail-generator && python -m pytest test_lambda_function.py -v
"""

from unittest.mock import patch, MagicMock
import pytest

from lambda_function import (
    lambda_handler,
    generate_thumbnail_key,
    should_process,
)


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


class TestLambdaHandler:
    """Lambda関数ハンドラーのテスト。"""

    @patch("lambda_function.s3_client")
    def test_successful_thumbnail_generation(self, mock_s3):
        """正常にサムネイルが生成される。"""
        import io
        from PIL import Image
        img = Image.new("RGB", (800, 600), color="red")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.put_object.return_value = {}

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "photlas-uploads-test"},
                    "object": {"key": "uploads/1/test.jpg"}
                }
            }]
        }

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        mock_s3.put_object.assert_called_once()
        call_args = mock_s3.put_object.call_args
        assert call_args[1]["Key"] == "thumbnails/uploads/1/test.webp"
        assert call_args[1]["ContentType"] == "image/webp"

    @patch("lambda_function.s3_client")
    def test_thumbnail_is_400x400_square(self, mock_s3):
        """Issue#75 - 非正方形画像から400x400の正方形サムネイルが中央クロップで生成される。"""
        import io
        from PIL import Image

        # 800x600の横長画像を作成
        img = Image.new("RGB", (800, 600), color="blue")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }

        captured_body = {}

        def capture_put(**kwargs):
            captured_body["data"] = kwargs["Body"]
            return {}

        mock_s3.put_object.side_effect = capture_put

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "photlas-uploads-test"},
                    "object": {"key": "uploads/1/test.jpg"}
                }
            }]
        }

        lambda_handler(event, None)

        # サムネイルが400x400の正方形であることを検証
        result_img = Image.open(io.BytesIO(captured_body["data"]))
        assert result_img.size == (400, 400), (
            f"サムネイルは400x400の正方形であるべきですが、{result_img.size}でした"
        )

    @patch("lambda_function.s3_client")
    def test_thumbnail_is_400x400_from_portrait(self, mock_s3):
        """Issue#75 - 縦長画像から400x400の正方形サムネイルが中央クロップで生成される。"""
        import io
        from PIL import Image

        # 600x800の縦長画像を作成
        img = Image.new("RGB", (600, 800), color="green")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }

        captured_body = {}

        def capture_put(**kwargs):
            captured_body["data"] = kwargs["Body"]
            return {}

        mock_s3.put_object.side_effect = capture_put

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "photlas-uploads-test"},
                    "object": {"key": "uploads/1/portrait.jpg"}
                }
            }]
        }

        lambda_handler(event, None)

        # サムネイルが400x400の正方形であることを検証
        result_img = Image.open(io.BytesIO(captured_body["data"]))
        assert result_img.size == (400, 400), (
            f"サムネイルは400x400の正方形であるべきですが、{result_img.size}でした"
        )

    @patch("lambda_function.s3_client")
    def test_thumbnail_format_is_webp(self, mock_s3):
        """Issue#75 - 生成されたサムネイルがWebPフォーマットである。"""
        import io
        from PIL import Image

        img = Image.new("RGB", (800, 600), color="red")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        jpeg_bytes = buf.getvalue()

        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }

        captured_body = {}

        def capture_put(**kwargs):
            captured_body["data"] = kwargs["Body"]
            return {}

        mock_s3.put_object.side_effect = capture_put

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "photlas-uploads-test"},
                    "object": {"key": "uploads/1/test.jpg"}
                }
            }]
        }

        lambda_handler(event, None)

        result_img = Image.open(io.BytesIO(captured_body["data"]))
        assert result_img.format == "WEBP", (
            f"サムネイルはWebPフォーマットであるべきですが、{result_img.format}でした"
        )

    @patch("lambda_function.s3_client")
    def test_skip_thumbnails_prefix(self, mock_s3):
        """thumbnails/プレフィックスのイベントはスキップされる。"""
        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "photlas-uploads-test"},
                    "object": {"key": "thumbnails/uploads/1/test.webp"}
                }
            }]
        }

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        mock_s3.get_object.assert_not_called()
