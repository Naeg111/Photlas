"""
Issue#54: スキャン用Lambda関数のユニットテスト

テスト実行: cd lambda/moderation-scanner && python -m pytest test_lambda_function.py -v

注: SNS ファンアウト経由のテストは test_sns_event.py に分離している。
"""

import json
from unittest.mock import patch, MagicMock

from lambda_function import (
    lambda_handler,
    scan_image,
    evaluate_result,
    callback_to_backend,
    STATUS_PUBLISHED,
    STATUS_QUARANTINED,
)


# --- evaluate_result テスト ---

class TestEvaluateResult:
    """スキャン結果評価のテスト。

    evaluate_result は (status, max_confidence, is_csam, filtered_label_names)
    の 4 値タプルを返す。
    """

    def test_no_labels_returns_published(self):
        """ラベルなしの場合、PUBLISHEDを返す。"""
        status, confidence, is_csam, _ = evaluate_result([])
        assert status == STATUS_PUBLISHED
        assert confidence == 0.0
        assert is_csam is False

    def test_low_confidence_returns_published(self):
        """信頼度50%未満の場合、PUBLISHEDを返す。"""
        labels = [{"Name": "Suggestive", "Confidence": 40.0}]
        status, confidence, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_PUBLISHED
        assert confidence == 40.0
        assert is_csam is False

    def test_high_confidence_returns_quarantined(self):
        """信頼度50%以上の場合、QUARANTINEDを返す。"""
        labels = [{"Name": "Explicit Nudity", "Confidence": 85.0}]
        status, confidence, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert confidence == 85.0
        assert is_csam is True

    def test_threshold_boundary_returns_quarantined(self):
        """信頼度がちょうど50%の場合、QUARANTINEDを返す。"""
        labels = [{"Name": "Violence", "Confidence": 50.0}]
        status, confidence, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert confidence == 50.0
        assert is_csam is False

    def test_csam_label_detected(self):
        """CSAMラベルが検出された場合、is_csamがTrueになる。"""
        labels = [{"Name": "Explicit Nudity", "Confidence": 90.0}]
        _, _, is_csam, _ = evaluate_result(labels)
        assert is_csam is True

    def test_non_csam_high_confidence(self):
        """CSAM以外の高信頼度ラベルの場合、is_csamはFalse。"""
        labels = [{"Name": "Violence", "Confidence": 95.0}]
        status, _, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert is_csam is False

    def test_multiple_labels_uses_max_confidence(self):
        """複数ラベルがある場合、最大信頼度で判定する。"""
        labels = [
            {"Name": "Suggestive", "Confidence": 30.0},
            {"Name": "Violence", "Confidence": 70.0},
            {"Name": "Drugs", "Confidence": 45.0},
        ]
        status, confidence, _, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert confidence == 70.0

    def test_below_threshold_with_csam_label(self):
        """CSAM関連ラベルでも信頼度50%未満ならPUBLISHED（CSAMフラグなし）。"""
        labels = [{"Name": "Explicit Nudity", "Confidence": 35.0}]
        status, _, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_PUBLISHED
        assert is_csam is False

    def test_excluded_label_is_not_quarantined(self):
        """除外ラベル（Tobacco等）は高信頼度でもPUBLISHEDになる。"""
        labels = [{"Name": "Smoking", "Confidence": 90.0}]
        status, _, _, _ = evaluate_result(labels)
        assert status == STATUS_PUBLISHED

    def test_excluded_and_blocked_labels_mixed(self):
        """除外ラベルとブロック対象が混在する場合、ブロック対象で判定される。"""
        labels = [
            {"Name": "Smoking", "Confidence": 95.0},         # 除外
            {"Name": "Graphic Violence", "Confidence": 80.0}, # ブロック対象
        ]
        status, confidence, _, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert confidence == 80.0

    def test_weapons_label_is_excluded(self):
        """Weaponsラベルは除外対象でPUBLISHEDになる。"""
        labels = [{"Name": "Weapons", "Confidence": 85.0}]
        status, _, _, _ = evaluate_result(labels)
        assert status == STATUS_PUBLISHED

    def test_csam_labels_v7_detected(self):
        """v7のCSAMラベル名が正しく検出される。"""
        labels = [{"Name": "Exposed Female Genitalia", "Confidence": 90.0}]
        status, _, is_csam, _ = evaluate_result(labels)
        assert status == STATUS_QUARANTINED
        assert is_csam is True

    def test_gambling_label_is_excluded(self):
        """Gamblingラベルは除外対象でPUBLISHEDになる。"""
        labels = [{"Name": "Gambling", "Confidence": 80.0}]
        status, _, _, _ = evaluate_result(labels)
        assert status == STATUS_PUBLISHED


# --- scan_image テスト ---

class TestScanImage:
    """Rekognitionスキャンのテスト。"""

    @patch("lambda_function.rekognition_client")
    def test_scan_image_calls_rekognition(self, mock_rekognition):
        """Rekognition APIが正しいパラメータで呼び出される。"""
        mock_rekognition.detect_moderation_labels.return_value = {
            "ModerationLabels": []
        }
        result = scan_image("test-bucket", "uploads/1/test.jpg")
        mock_rekognition.detect_moderation_labels.assert_called_once_with(
            Image={"S3Object": {"Bucket": "test-bucket", "Name": "uploads/1/test.jpg"}},
            MinConfidence=30,
        )
        assert result == []


# --- callback_to_backend テスト ---

class TestCallbackToBackend:
    """バックエンドAPIコールバックのテスト。

    callback_to_backend(s3_object_key, status, confidence_score, detected_labels=None)
    """

    @patch("lambda_function.BACKEND_API_URL", "https://test-api.photlas.jp")
    @patch("lambda_function.MODERATION_API_KEY", "test-api-key")
    @patch("lambda_function.urllib.request.urlopen")
    def test_callback_sends_correct_request(self, mock_urlopen):
        """正しいURLとヘッダーでAPIを呼び出す。"""
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        callback_to_backend("uploads/1/test.jpg", STATUS_PUBLISHED, 30.0)

        mock_urlopen.assert_called_once()
        call_args = mock_urlopen.call_args
        req = call_args[0][0]

        assert req.full_url == "https://test-api.photlas.jp/api/v1/internal/moderation/callback"
        assert req.get_header("X-api-key") == "test-api-key"
        assert req.get_header("Content-type") == "application/json"

        body = json.loads(req.data.decode("utf-8"))
        assert body["s3_object_key"] == "uploads/1/test.jpg"
        assert body["status"] == STATUS_PUBLISHED
        assert body["confidence_score"] == 30.0


# --- lambda_handler テスト ---

class TestLambdaHandler:
    """Lambda関数ハンドラのテスト。

    注: 旧実装で存在した move_to_quarantine 関数は S3 移動の責務が
    バックエンドに移管された際に Lambda から削除されているため、
    本テストでは move_to_quarantine の呼び出し検証は行わない。
    """

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_safe_image_is_published(
        self, mock_scan, mock_callback, mock_slack
    ):
        """安全な画像はPUBLISHEDになる。"""
        mock_scan.return_value = []

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": "uploads/1/safe.jpg"},
                },
            }],
        }

        lambda_handler(event, None)

        mock_callback.assert_called_once()
        # 第 1〜3 引数の確認（detected_labels はラベルなしなので [] が渡される）
        args = mock_callback.call_args[0]
        assert args[0] == "uploads/1/safe.jpg"
        assert args[1] == STATUS_PUBLISHED
        assert args[2] == 0.0
        mock_slack.assert_not_called()

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_unsafe_image_is_quarantined(
        self, mock_scan, mock_callback, mock_slack
    ):
        """不適切な画像はQUARANTINEDになり、Slack通知が送信される。"""
        labels = [{"Name": "Violence", "Confidence": 80.0}]
        mock_scan.return_value = labels

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": "uploads/1/unsafe.jpg"},
                },
            }],
        }

        lambda_handler(event, None)

        mock_callback.assert_called_once()
        args = mock_callback.call_args[0]
        assert args[0] == "uploads/1/unsafe.jpg"
        assert args[1] == STATUS_QUARANTINED
        assert args[2] == 80.0
        mock_slack.assert_called_once()

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_quarantined_prefix_is_skipped(
        self, mock_scan, mock_callback, mock_slack
    ):
        """隔離プレフィックスのオブジェクトはスキップされる。"""
        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": "quarantined/uploads/1/test.jpg"},
                },
            }],
        }

        lambda_handler(event, None)

        mock_scan.assert_not_called()
        mock_callback.assert_not_called()

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_profile_image_is_scanned(
        self, mock_scan, mock_callback, mock_slack
    ):
        """プロフィール画像もスキャンされる。"""
        mock_scan.return_value = []

        event = {
            "Records": [{
                "s3": {
                    "bucket": {"name": "test-bucket"},
                    "object": {"key": "profile-images/1/avatar.jpg"},
                },
            }],
        }

        lambda_handler(event, None)

        mock_scan.assert_called_once_with("test-bucket", "profile-images/1/avatar.jpg")
        mock_callback.assert_called_once()
