"""
Issue#100 関連: SNS ファンアウト経由イベント対応のテスト

setup-s3-notifications.sh の修正で S3 → SNS → 複数 Lambda の構成にした際、
moderation Lambda が SNS でラップされたイベントを受け取れるよう正規化する必要がある。

注: 既存の test_lambda_function.py は move_to_quarantine / QUARANTINED_PREFIX という
存在しないシンボルを import しており、ファイル全体が import エラーで動かない状態のため、
本ファイルでは独立して SNS 関連のテストのみを記述する（既存テストの修正は別件として扱う）。

テスト実行: cd lambda/moderation-scanner && python -m pytest test_sns_event.py -v
"""

import json
from unittest.mock import patch

from lambda_function import lambda_handler


def make_direct_s3_event(s3_key, bucket="test-bucket"):
    """S3 から直接 Lambda が受け取るイベント（従来形式）を生成する。"""
    return {
        "Records": [{
            "s3": {
                "bucket": {"name": bucket},
                "object": {"key": s3_key},
            }
        }]
    }


def make_sns_wrapped_s3_event(s3_key, bucket="test-bucket"):
    """S3 イベントを SNS 経由で受け取るときの Lambda イベント形式を生成する。"""
    s3_event = make_direct_s3_event(s3_key, bucket)
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
                "Message": json.dumps(s3_event),
                "Timestamp": "2026-05-01T00:00:00.000Z",
            }
        }]
    }


class TestSnsWrappedEvent:
    """SNS ファンアウト経由でイベントを受け取った場合の moderation Lambda 動作。"""

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_sns_wrapped_event_processed_correctly(
        self, mock_scan, mock_callback, mock_slack
    ):
        """SNS ラッパー経由の S3 イベントでもスキャンが実行される。"""
        mock_scan.return_value = []

        event = make_sns_wrapped_s3_event("uploads/1/from-sns.jpg")
        lambda_handler(event, None)

        mock_scan.assert_called_once_with("test-bucket", "uploads/1/from-sns.jpg")
        mock_callback.assert_called_once()

    @patch("lambda_function.send_slack_notification")
    @patch("lambda_function.callback_to_backend")
    @patch("lambda_function.scan_image")
    def test_direct_s3_event_still_works(
        self, mock_scan, mock_callback, mock_slack
    ):
        """直接の S3 イベント（後方互換）も従来どおり処理される。"""
        mock_scan.return_value = []

        event = make_direct_s3_event("uploads/1/direct.jpg")
        lambda_handler(event, None)

        mock_scan.assert_called_once_with("test-bucket", "uploads/1/direct.jpg")
        mock_callback.assert_called_once()
