// Issue#117: 通常時の CloudFront Function コード。
// メンテナンスモードでないとき、リクエストを書き換えずそのままオリジン
// (S3) に転送する。`scripts/maintenance-off.sh` がこのコードを CloudFront
// Function に publish して通常運用に戻す。
function handler(event) {
  return event.request;
}
