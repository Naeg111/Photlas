"""
Issue#125 Cycle2: LQIP（低品質プレースホルダー）生成 + コールバックのテスト

テスト実行: cd lambda/thumbnail-generator && python3 -m pytest test_lqip.py -v

別ファイルに分離している理由: LQIP 関連の関数 (generate_lqip / post_lqip_to_backend)
は Cycle2 で実装する。test_lambda_function.py の trunk 部分と分離することで、
Red 段階の import エラーが既存テストの collection を妨げない。
"""

import io
from unittest.mock import patch, MagicMock

from PIL import Image

from lambda_function import (
    generate_lqip,
    post_lqip_to_backend,
    lambda_handler,
    LQIP_SIZE,
    LQIP_QUALITY,
    LQIP_CALLBACK_RETRY_DELAYS,
)

TEST_BUCKET = "photlas-uploads-test"


def create_test_image(width, height, color="red", fmt="JPEG"):
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def create_s3_event(key, bucket=TEST_BUCKET):
    return {
        "Records": [{
            "s3": {
                "bucket": {"name": bucket},
                "object": {"key": key}
            }
        }]
    }


class TestLqipConstants:
    """Issue#125 - LQIP モジュール定数の値が想定通り。"""

    def test_lqip_size_is_20(self):
        assert LQIP_SIZE == 20

    def test_lqip_quality_is_30(self):
        assert LQIP_QUALITY == 30

    def test_retry_delays_are_exponential_backoff(self):
        """指数バックオフ: 1s → 3s → 9s（3 回リトライ）。"""
        assert LQIP_CALLBACK_RETRY_DELAYS == (1, 3, 9)


class TestGenerateLqip:
    """Issue#125 - generate_lqip(image) が WebP 形式で小さなバイト列を返す。"""

    def test_starts_with_webp_magic_bytes(self):
        """出力は WebP マジックバイト RIFF...WEBP で始まる。"""
        img = Image.new("RGB", (800, 800), color="red")

        result = generate_lqip(img)

        # WebP の magic: 'RIFF' (4) + size (4) + 'WEBP' (4)
        assert result[0:4] == b"RIFF"
        assert result[8:12] == b"WEBP"

    def test_size_within_expected_range(self):
        """LQIP サイズは 2000 byte 以下に収まる（容量上限の防御）。"""
        # 自然な画像に近づけるため、グラデーションのある画像を使用
        img = Image.new("RGB", (800, 800))
        for y in range(0, 800, 8):
            for x in range(0, 800, 8):
                img.putpixel((x, y), (x % 256, y % 256, (x + y) % 256))

        result = generate_lqip(img)

        assert 0 < len(result) <= 2000, (
            f"LQIP サイズが想定範囲外: {len(result)} byte"
        )

    def test_does_not_mutate_input_image(self):
        """元の image オブジェクトのサイズは変わらない（generate_lqip が破壊的でない）。"""
        img = Image.new("RGB", (800, 800), color="blue")
        original_size = img.size

        generate_lqip(img)

        assert img.size == original_size


class TestPostLqipToBackend:
    """Issue#125 - post_lqip_to_backend がリトライ + 最終 False を正しく扱う。"""

    def setup_method(self):
        """各テスト前に環境変数を設定（urlopen が呼ばれる前提条件）。"""
        import os as _os
        _os.environ["BACKEND_URL"] = "https://test.photlas.jp"
        _os.environ["MODERATION_API_KEY"] = "test-key"

    def teardown_method(self):
        """各テスト後に環境変数をクリア。"""
        import os as _os
        _os.environ.pop("BACKEND_URL", None)
        _os.environ.pop("MODERATION_API_KEY", None)

    @patch("lambda_function.urllib.request.urlopen")
    @patch("lambda_function.time.sleep")
    def test_returns_true_on_first_success(self, mock_sleep, mock_urlopen):
        """初回成功時は True、リトライしない。"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        result = post_lqip_to_backend(
            "uploads/1/test.jpg", "data:image/webp;base64,XYZ"
        )

        assert result is True
        assert mock_urlopen.call_count == 1

    @patch("lambda_function.urllib.request.urlopen")
    @patch("lambda_function.time.sleep")
    def test_retries_on_failure_then_succeeds(self, mock_sleep, mock_urlopen):
        """失敗 → 失敗 → 成功で最終 True、urlopen が 3 回呼ばれる。"""
        mock_response_ok = MagicMock()
        mock_response_ok.status = 200
        mock_response_ok.__enter__.return_value = mock_response_ok

        mock_urlopen.side_effect = [
            Exception("network error 1"),
            Exception("network error 2"),
            mock_response_ok,
        ]

        result = post_lqip_to_backend(
            "uploads/1/test.jpg", "data:image/webp;base64,XYZ"
        )

        assert result is True
        assert mock_urlopen.call_count == 3

    @patch("lambda_function.urllib.request.urlopen")
    @patch("lambda_function.time.sleep")
    def test_returns_false_after_three_failures(self, mock_sleep, mock_urlopen):
        """3 回全失敗で False。例外を伝播しない。"""
        mock_urlopen.side_effect = Exception("persistent network error")

        result = post_lqip_to_backend(
            "uploads/1/test.jpg", "data:image/webp;base64,XYZ"
        )

        assert result is False
        assert mock_urlopen.call_count == 3


class TestLambdaHandlerIntegratesLqip:
    """Issue#125 - lambda_handler がサムネ生成後に LQIP コールバックを呼ぶ。"""

    @patch("lambda_function.post_lqip_to_backend")
    @patch("lambda_function.s3_client")
    def test_lqip_callback_is_invoked_after_thumbnail(self, mock_s3, mock_post):
        """サムネ書き込み成功後に post_lqip_to_backend が呼ばれる。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.put_object.return_value = {}
        mock_post.return_value = True

        lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        mock_post.assert_called_once()
        # 呼び出し引数: (s3_object_key, lqip_data_url)
        call_args = mock_post.call_args[0]
        assert call_args[0] == "uploads/1/test.jpg"
        assert call_args[1].startswith("data:image/webp;base64,")

    @patch("lambda_function.post_lqip_to_backend")
    @patch("lambda_function.s3_client")
    def test_lambda_succeeds_even_when_callback_returns_false(self, mock_s3, mock_post):
        """LQIP コールバックが失敗しても Lambda 自体は 200 で完了する
        （サムネ生成が成功している以上、写真の公開を妨げない）。"""
        jpeg_bytes = create_test_image(800, 600)
        mock_s3.get_object.return_value = {
            "Body": MagicMock(read=MagicMock(return_value=jpeg_bytes))
        }
        mock_s3.put_object.return_value = {}
        mock_post.return_value = False  # コールバック失敗

        result = lambda_handler(create_s3_event("uploads/1/test.jpg"), None)

        assert result["statusCode"] == 200
