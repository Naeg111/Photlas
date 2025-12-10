# CLAUDE.md

このファイルは、このリポジトリのコードを扱う際に、Claude Code (claude.ai/code) に与えるためのガイダンスです。

## 関連ドキュメント
実装に着手する前に、以下の設計資料を必ず参照してください。

- **要件定義書**: `documents/requirements/` 配下に格納されています。
- **設計書 (エピック, アーキテクチャ等)**: `documents/design/` 配下に格納されています。
- **Issue**: `documents/Issues/` 配下に格納されています。

---
## プロジェクト概要

Photlasは、写真撮影の目的地探しを効率化し、旅行者が目的地を決定する際の判断を支援するWebアプリケーションです。ReactのフロントエンドとSpring Bootのバックエンドを持つ、フルスタック構成のプロジェクトです。

---
## 開発用コマンド

### フロントエンド (React + Vite + TypeScript)
```bash
cd frontend
pnpm install          # 依存関係のインストール
pnpm dev              # 開発サーバーの起動 (http://localhost:5173)
pnpm build            # 本番用のビルド
pnpm preview          # 本番用ビルドのプレビュー
pnpm test             # テストの実行 (Vitest)
pnpm test:ui          # テストUIの実行
pnpm test:run         # テストの単発実行
pnpm coverage         # カバレッジ付きテスト実行
```

### バックエンド (Spring Boot + Gradle + Java 21)
```bash
cd backend
./gradlew bootRun     # 開発サーバーの起動 (http://localhost:8080)
./gradlew build       # プロジェクトのビルド
./gradlew test        # テストの実行
```

### ヘルスチェック
```bash
curl http://localhost:8080/api/v1/health
# 期待されるレスポンス: {"status":"UP"}
```

---
## アーキテクチャ

### 技術スタック
- **フロントエンド**: React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router, Vitest
- **バックエンド**: Java 21, Spring Boot 3.5.6, Gradle 8.14.3
- **テスト**: Vitest (フロントエンド), JUnit 5 (バックエンド)
- **インフラ計画**: Vercel (フロントエンド), AWS EC2/ECS (バックエンド), PostgreSQL, S3

### プロジェクト構造
```
photlas/
├── backend/                    # Spring Boot APIサーバー
│   ├── src/main/java/com/photlas/backend/
│   │   ├── PhotlasBackendApplication.java    # メインクラス
│   │   └── controller/
│   │       └── HealthController.java         # ヘルスチェック用エンドポイント
│   ├── build.gradle            # ビルド設定
│   └── gradlew                 # Gradleラッパー
│
├── frontend/                   # React SPAクライアント
│   ├── src/
│   │   ├── App.tsx             # ルーティングを含むメインコンポーネント
│   │   ├── main.tsx            # エントリーポイント
│   │   ├── components/         # 再利用可能なUIコンポーネント
│   │   └── pages/              # 各ページのコンポーネント
│   ├── package.json
│   ├── vite.config.ts          # Vite設定
│   └── vitest.config.ts        # テスト設定
│
├── design-assets/              # プロジェクトに取り込むフロントエンド資材
│   └── Photlas/
│       ├── COMPONENT_MAPPING.md  # コンポーネントとボタン操作の対応表
│       └── src/                  # Figma Makeで生成されたデザインコード
│
└── design-backup/              # フロントエンド資材のバックアップ（git管理対象外）
    └── [バージョン別バックアップ]  # 資材更新時に差分管理用として保存
```

### デザインアセットディレクトリ
- **design-assets/**: Figma Make等で生成された高品質なUIデザインコードを格納。プロジェクトへの統合前に、ここで内容を確認・検証する。
  - `COMPONENT_MAPPING.md`: どのコンポーネント名がどのボタンや機能に対応するかを示すマッピングドキュメント
- **design-backup/**: デザイン資材のバックアップ用ディレクトリ（.gitignoreで除外）。資材を更新するたびに別々に保存し、必要に応じて差分のみを反映できるようにする。

---
## 現在の実装ステータス

- ✅ プロジェクトセットアップと基本レイアウト (Issue #1)
- ✅ ユーザー登録機能 (UI) (Issue #2)
- 🚧 ユーザー登録機能 (API) (Issue #3)
- 📋 Docker環境の導入 (Issue #4)
- 📋 ログイン・ログアウト機能 (Issue #5)

---
## APIエンドポイント（計画中）

### 認証
- `POST /api/v1/auth/register` - 新規ユーザー登録
- `POST /api/v1/auth/login` - ログイン

### ユーザー
- `GET /api/v1/users/me` - ログイン中ユーザーの情報取得
- `PUT /api/v1/users/me/profile` - プロフィール更新
- `GET /api/v1/users/{userId}/photos` - 特定ユーザーの写真一覧取得

### 写真
- `POST /api/v1/photos/upload-url` - 写真アップロード用URLの発行
- `GET /api/v1/photos/{photoId}` - 写真詳細の取得
- `PUT /api/v1/photos/{photoId}` - 写真情報の更新
- `DELETE /api/v1/photos/{photoId}` - 写真の削除

### スポット
- `GET /api/v1/spots` - 指定範囲内のスポット取得

---
## テスト戦略

- **フロントエンド**: VitestとReact Testing Libraryによるコンポーネントテストを主軸とする。
- **バックエンド**: JUnit 5とSpring Boot Testを利用した、単体テストおよび結合テストを主軸とする。