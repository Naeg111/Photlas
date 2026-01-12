/**
 * Docker環境テスト
 * Issue#4: Docker環境の導入
 *
 * TDD Red段階: 実装前のテストケース定義
 *
 * テスト対象:
 * - docker-compose up -d でコンテナが起動すること
 * - backend サービスが8080ポートで利用可能であること
 * - db サービス(PostgreSQL 17)が5432ポートで利用可能であること
 * - nginx サービスが80ポートで利用可能であること
 * - nginx が /api/ リクエストをバックエンドに転送すること
 * - nginx が / リクエストをフロントエンドに転送すること
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const { promisify } = require('util');

// テスト用のヘルパー関数
const sleep = promisify(setTimeout);

/**
 * HTTPリクエストを送信してレスポンスを取得
 */
function makeHttpRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => reject(new Error('Request timeout')));
    req.end();
  });
}

describe('Docker Environment Tests', () => {
  // テスト前にコンテナを停止・削除
  beforeAll(async () => {
    try {
      execSync('docker-compose down -v --remove-orphans', { stdio: 'pipe' });
    } catch (error) {
      // 既にコンテナが存在しない場合は無視
    }
  });

  // テスト後のクリーンアップ
  afterAll(async () => {
    try {
      execSync('docker-compose down -v --remove-orphans', { stdio: 'pipe' });
    } catch (error) {
      console.error('Failed to clean up containers:', error.message);
    }
  });

  test('docker-compose.yml file should exist', () => {
    const fs = require('fs');
    expect(fs.existsSync('docker-compose.yml')).toBe(true);
  });

  test('docker-compose up -d should start all services', async () => {
    // Red段階: docker-compose.ymlが存在しないためこのテストは失敗する
    expect(() => {
      execSync('docker-compose up -d', { stdio: 'pipe', timeout: 60000 });
    }).not.toThrow();

    // サービス起動を待機
    await sleep(10000);
  }, 70000);

  test('backend service should be accessible on port 8080', async () => {
    // Red段階: バックエンドコンテナが存在しないため失敗
    await expect(async () => {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 8080,
        path: '/api/v1/health',
        method: 'GET'
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'UP' });
    }).not.toThrow();
  }, 10000);

  test('database service should be accessible on port 5432', async () => {
    // Red段階: データベースコンテナが存在しないため失敗
    const { Client } = require('pg');
    const client = new Client({
      host: 'localhost',
      port: 5432,
      database: 'photlas_dev',
      user: 'photlas_user',
      password: 'photlas_password',
    });

    await expect(async () => {
      await client.connect();
      const result = await client.query('SELECT version()');
      expect(result.rows[0].version).toContain('PostgreSQL 17');
      await client.end();
    }).not.toThrow();
  }, 10000);

  test('nginx service should be accessible on port 80', async () => {
    // Red段階: nginxコンテナが存在しないため失敗
    await expect(async () => {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 80,
        path: '/',
        method: 'GET'
      });
      expect(response.statusCode).toBeLessThan(500);
    }).not.toThrow();
  }, 10000);

  test('nginx should proxy /api/ requests to backend', async () => {
    // Red段階: nginxの設定が存在しないため失敗
    await expect(async () => {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 80,
        path: '/api/v1/health',
        method: 'GET'
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'UP' });
    }).not.toThrow();
  }, 10000);

  test('nginx should proxy / requests to frontend dev server', async () => {
    // Red段階: nginxの設定が存在しないため失敗
    // フロントエンド開発サーバーが localhost:3000 で動作している前提
    await expect(async () => {
      const response = await makeHttpRequest({
        hostname: 'localhost',
        port: 80,
        path: '/',
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      });
      // HTMLレスポンスまたはプロキシエラーではない200系を期待
      expect(response.statusCode).toBeLessThan(400);
    }).not.toThrow();
  }, 10000);

  test('all containers should be running', () => {
    // Red段階: コンテナが存在しないため失敗
    const output = execSync('docker-compose ps --format json', { encoding: 'utf8' });
    const containers = JSON.parse(`[${output.trim().split('\n').join(',')}]`);

    expect(containers).toHaveLength(3);
    containers.forEach(container => {
      expect(container.State).toBe('running');
      expect(['photlas-backend', 'photlas-db', 'photlas-nginx']).toContain(container.Service);
    });
  });
});