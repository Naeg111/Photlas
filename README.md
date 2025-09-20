# Photlas

写真を撮る人、そして写真を参考に旅先を決める人の、場所の探索と意思決定を効率化し、最適な体験の獲得を支援するWebアプリケーション。

## 技術スタック

### バックエンド
- **言語**: Java 21
- **フレームワーク**: Spring Boot 3.5.6
- **ビルドツール**: Gradle 8.14.3
- **データベース**: PostgreSQL（予定）

### フロントエンド
- **言語**: TypeScript
- **フレームワーク**: React 19
- **ビルドツール**: Vite 7
- **スタイリング**: Tailwind CSS 4

### インフラ
- **フロントエンド**: Vercel
- **バックエンド**: AWS (EC2/ECS)
- **データストレージ**: AWS RDS (PostgreSQL), S3

## 開発環境のセットアップ

### 前提条件
- Java 21
- Node.js 18+
- pnpm

### バックエンドの起動

```bash
cd backend
./gradlew bootRun
```

バックエンドは `http://localhost:8080` で起動します。

#### ヘルスチェック
```bash
curl http://localhost:8080/api/v1/health
# 期待されるレスポンス: {"status":"UP"}
```

### フロントエンドの起動

```bash
cd frontend
pnpm install
pnpm dev
```

フロントエンドは `http://localhost:5173` で起動します。

## プロジェクト構造

```
photlas/
├── backend/          # Spring Bootバックエンド
│   ├── build.gradle
│   └── src/
│       └── main/
│           └── java/
│               └── com/photlas/backend/
└── frontend/         # React + TypeScriptフロントエンド
    ├── package.json
    └── src/
        ├── components/
        └── App.tsx
```

## 機能要件

### 主要機能
1. **ユーザー認証**: メールアドレスとパスワードによる登録・ログイン
2. **写真投稿**: 位置情報付き写真の投稿と管理
3. **地図ベース発見**: 地図インターフェースによる撮影地の探索
4. **フィルタリング**: カテゴリ、時期、天候による絞り込み

### 対象エピック
- ユーザー認証機能
- 写真投稿機能（Contribution）
- 地図ベースによる撮影地発見機能（Discovery）

## API仕様

### 認証
- `POST /api/v1/auth/register` - 新規ユーザー登録
- `POST /api/v1/auth/login` - ログイン

### ユーザー
- `GET /api/v1/users/me` - ログイン中のユーザー情報を取得

### スポット
- `GET /api/v1/spots` - 指定範囲内のスポット情報を取得

### 写真
- `POST /api/v1/photos/upload-url` - 写真アップロード用の署名付きURL発行
- `GET /api/v1/photos/{photoId}` - 特定の写真の詳細情報を取得

## 開発状況

- [x] プロジェクトセットアップと基本レイアウト (Issue #1)
- [ ] ユーザー登録機能 UI (Issue #2)
- [ ] ユーザー認証API実装
- [ ] 写真投稿機能実装
- [ ] 地図機能実装

## ライセンス

このプロジェクトは開発中のため、ライセンスは未定です。
