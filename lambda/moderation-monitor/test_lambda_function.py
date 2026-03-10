"""
Issue#54: 監視用Lambda関数のユニットテスト

テスト実行: cd lambda/moderation-monitor && python -m pytest test_lambda_function.py -v
"""

import json
from unittest.mock import patch, MagicMock

import pytest

from lambda_function import (
    lambda_handler,
    check_stale_pending_reviews,
    send_slack_alert,
)


class TestCheckStalePendingReviews:
    """滞留チェックAPIのテスト。"""

    @patch("lambda_function.BACKEND_API_URL", "https://test-api.photlas.jp")
    @patch("lambda_function.MODERATION_API_KEY", "test-key")
    @patch("lambda_function.urllib.request.urlopen")
    def test_returns_stale_count(self, mock_urlopen):
        """滞留件数を正しく返す。"""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"stale_count": 3}).encode()
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        count = check_stale_pending_reviews()
        assert count == 3

    @patch("lambda_function.BACKEND_API_URL", "https://test-api.photlas.jp")
    @patch("lambda_function.MODERATION_API_KEY", "test-key")
    @patch("lambda_function.urllib.request.urlopen")
    def test_returns_zero_when_no_stale(self, mock_urlopen):
        """滞留なしの場合0を返す。"""
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"stale_count": 0}).encode()
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        count = check_stale_pending_reviews()
        assert count == 0


class TestLambdaHandler:
    """Lambda関数ハンドラのテスト。"""

    @patch("lambda_function.send_slack_alert")
    @patch("lambda_function.check_stale_pending_reviews")
    def test_no_stale_no_slack(self, mock_check, mock_slack):
        """滞留なしの場合、Slack通知しない。"""
        mock_check.return_value = 0

        result = lambda_handler({}, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["stale_count"] == 0
        mock_slack.assert_not_called()

    @patch("lambda_function.send_slack_alert")
    @patch("lambda_function.check_stale_pending_reviews")
    def test_stale_sends_slack(self, mock_check, mock_slack):
        """滞留ありの場合、Slack通知する。"""
        mock_check.return_value = 5

        result = lambda_handler({}, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["stale_count"] == 5
        mock_slack.assert_called_once_with(5)

    @patch("lambda_function.send_slack_error_alert")
    @patch("lambda_function.check_stale_pending_reviews")
    def test_error_sends_error_alert(self, mock_check, mock_error_slack):
        """エラー時にエラーアラートを送信する。"""
        mock_check.side_effect = Exception("API error")

        with pytest.raises(Exception, match="API error"):
            lambda_handler({}, None)

        mock_error_slack.assert_called_once()


class TestSendSlackAlert:
    """Slack通知のテスト。"""

    @patch("lambda_function.SLACK_WEBHOOK_URL", "https://hooks.slack.com/test")
    @patch("lambda_function.urllib.request.urlopen")
    def test_sends_alert_with_count(self, mock_urlopen):
        """滞留件数を含むアラートを送信する。"""
        mock_response = MagicMock()
        mock_response.__enter__ = MagicMock(return_value=mock_response)
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        send_slack_alert(3)

        mock_urlopen.assert_called_once()
        call_args = mock_urlopen.call_args
        req = call_args[0][0]
        body = json.loads(req.data.decode())
        assert "3件" in body["text"]

    @patch("lambda_function.SLACK_WEBHOOK_URL", "")
    @patch("lambda_function.urllib.request.urlopen")
    def test_skips_when_no_webhook(self, mock_urlopen):
        """Webhook URLが未設定の場合はスキップする。"""
        send_slack_alert(3)
        mock_urlopen.assert_not_called()
