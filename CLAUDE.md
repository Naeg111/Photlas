# Photlas プロジェクト - Claude 向けガイド

このドキュメントは、Claude Code が Photlas プロジェクトで効果的に作業するための情報を提供します。

## プロジェクト概要

Photlas は、写真を通じて撮影スポットを共有・発見できる Web アプリケーションです。

### プロジェクトの背景と目的

このプロジェクトには複数の目的があります：
1. **プロダクトとしての価値提供**: 自分のアイデアを形にして人々に使ってもらいたいという思い
2. **AI駆動開発の学習**: これから主流になるAI駆動開発のやり方を学ぶ実践の場
3. **転職活動でのアピール材料**: 個人開発の実績として活用

コールドスタート問題の厳しさは承知の上で開発を進めています。SEO等を工夫して辛抱強く粘る方針ですが、場合によっては企業への売却も選択肢に含めています。

### 技術スタック

**フロントエンド:**
- React 18 + TypeScript
- Vite
- React Router
- Tailwind CSS
- Vitest (テスト)

**バックエンド:**
- Spring Boot 3.x
- Java 21
- PostgreSQL
- JUnit 5 (テスト)
- Spring Security + JWT認証

**インフラ:**
- Docker / Docker Compose
- AWS S3 (画像保存)
- GitHub Actions (CI/CD)

## 開発フロー

### TDD (Test-Driven Development)

このプロジェクトは TDD を採用しています：

1. **Red 段階**: テストを先に書く（失敗することを確認）
2. **Green 段階**: テストが通る最小限の実装
3. **Refactor 段階**: コードの品質向上（定数化、ヘルパーメソッド作成など）

### ブランチ戦略（Git Flow）

```
main ─────────────────────────► 本番環境（photlas.jp）
  │
  └─► develop ────────────────► テスト環境（test.photlas.jp）
        │
        └─► feature/xxx ──────► 機能開発
```

- `main`: 本番環境用（保護されたブランチ）- photlas.jp へデプロイ
- `develop`: テスト環境用 - test.photlas.jp へデプロイ
- `feature/*`: 機能開発用ブランチ（developから作成、developへマージ）
- 各 Issue ごとに専用のブランチを作成

**ワークフロー:**
1. `develop` から `feature/xxx` ブランチを作成
2. 機能開発・テスト
3. `feature/xxx` を `develop` へマージ → テスト環境へ自動デプロイ
4. テスト環境で動作確認
5. `develop` を `main` へマージ → 本番環境へデプロイ

### コミットメッセージ

以下の形式を使用：
```
<type>: <subject>

<body>
```

**Type:**
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `docs`: ドキュメント更新
- `style`: コードスタイル修正

#### Claude をコントリビューターに含めない（厳守）

このプロジェクトでは **Claude Code を共同作成者（Co-Author）として扱いません**。コミット・PR 作成時は以下を必ず遵守してください：

- コミットメッセージに `Co-Authored-By: Claude ...` 行を**一切付けない**（`Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` 等を含め、いかなる形でも不可）
- PR 本文にも Claude 由来のフッタ（`🤖 Generated with Claude Code` 等）を付けない
- `git commit -m "..."` のヒアドキュメント例にも Co-Authored-By を混入させない
- 自動付与されないよう、プロジェクト設定 `.claude/settings.json` で `attribution.commit: ""` / `attribution.pr: ""` を設定済み（Claude Code 標準の co-author 自動トレーラ機能を無効化）
- コミット作成直前・直後に `git log -1 --format=%B` で該当行が混入していないか必ず確認する
- 過去履歴からも該当行は全て除去済み（2026-04-19 実施、filter-repo）

## ディレクトリ構造

```
Photlas/
├── backend/              # Spring Boot バックエンド
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/photlas/backend/
│   │   │   │   ├── controller/    # REST API エンドポイント
│   │   │   │   ├── service/       # ビジネスロジック
│   │   │   │   ├── repository/    # データアクセス層
│   │   │   │   ├── entity/        # エンティティ
│   │   │   │   ├── dto/           # データ転送オブジェクト
│   │   │   │   ├── exception/     # カスタム例外
│   │   │   │   ├── config/        # 設定クラス
│   │   │   │   └── filter/        # フィルター
│   │   │   └── resources/
│   │   └── test/java/com/photlas/backend/
│   ├── build.gradle
│   └── gradlew
├── frontend/             # React フロントエンド
│   ├── src/
│   │   ├── components/   # 再利用可能なコンポーネント
│   │   ├── pages/        # ページコンポーネント
│   │   ├── test/         # テスト設定
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── documents/            # プロジェクトドキュメント
│   ├── 01_要件定義/      # プロダクト要件・エピック・競合分析
│   ├── 02_機能仕様/      # 個別機能の詳細仕様
│   ├── 03_設計/          # アーキテクチャ・DB・API・UI・規約・インフラ構成
│   ├── 04_Issues/        # Issue管理
│   ├── 05_試験管理/      # テスト仕様書・実施レポート・脆弱性検査
│   ├── 06_運用/          # インフラレポート・リリース手順・チェックリスト
│   ├── 07_精査レポート/  # セキュリティ監査・コンプライアンス・ローンチ前精査
│   └── 08_調査・学習/    # 技術ガイド・法規制調査・戦略レポート
└── docker-compose.yml
```

## 重要なルール

### コーディング規約

**必ず `documents/03_設計/05_coding_standards.md` に定義された規約を遵守してください。**

コード記述時の重要な原則：
1. **可読性を最優先する**: 誰が読んでも理解できるコードを書く
2. **一貫性を保つ**: プロジェクト全体で統一されたスタイルを使用
3. **単純性を重視する**: 複雑な処理は小さな関数に分割

**Java (Backend) 主要ルール:**
- クラス名: PascalCase（例: `UserController`, `PhotoService`）
- メソッド/変数名: camelCase（例: `findUserById`, `currentUser`）
- 定数: UPPER_SNAKE_CASE（例: `MAX_FILE_SIZE`, `DEFAULT_PROFILE_IMAGE`）
- メソッドの長さ: 5-20行を理想とし、最大30行以内
- 引数の数: 0-2個を理想とし、3個以上はDTOにまとめる
- 早期リターンを使用してネストを減らす
- public メソッドには必ずJavadocを記述
- テストメソッド: `@DisplayName` アノテーションで日本語説明を記載

**TypeScript (Frontend) 主要ルール:**
- コンポーネント名: PascalCase（例: `LoginPage`, `PhotoUploadDialog`）
- 関数/変数名: camelCase（例: `handleSubmit`, `isLoading`）
- Boolean型: `is`, `has`, `should` で始める（例: `isLoading`, `hasError`）
- イベントハンドラー: `handle` で始める（例: `handleClick`, `handleSubmit`）
- 定数: UPPER_CASE（例: `MAX_FILE_SIZE`, `ALLOWED_FILE_TYPES`）
- ファイル名: コンポーネントは PascalCase.tsx、その他は camelCase.ts
- Propsは必ず型定義する
- 関数の長さ: 5-20行を理想とする
- 非同期処理は必ずエラーハンドリングする

**詳細は `documents/03_設計/05_coding_standards.md` を参照してください。**

### テストの書き方

**バックエンド (JUnit 5):**
```java
@DisplayName("Issue#XX - テストケースの説明")
void testMethodName() {
    // Given: テストデータ準備

    // When: テスト対象実行

    // Then: 結果検証
}
```

**フロントエンド (Vitest + React Testing Library):**
```typescript
it('should render component correctly', () => {
  render(<Component />)
  expect(screen.getByText('Expected Text')).toBeInTheDocument()
})
```

### Issue 管理

- 各 Issue には `Issue#XX` 形式の番号を付与
- Issue ドキュメントは `documents/04_Issues/Issue#XX.md` に配置
- コード内のコメントで Issue 番号を参照（例: `// Issue#6: パスワードリセット機能`）

## よくあるタスク

### ローカル環境のセットアップ

```bash
# バックエンド起動
cd backend
./gradlew bootRun

# フロントエンド起動
cd frontend
pnpm install
pnpm dev

# Docker で PostgreSQL 起動
docker-compose up -d postgres
```

### テスト実行

```bash
# バックエンドテスト
cd backend
./gradlew test

# フロントエンドテスト
cd frontend
pnpm test
```

### ビルド

```bash
# バックエンドビルド
cd backend
./gradlew build

# フロントエンドビルド
cd frontend
pnpm build
```

## Lambda関数のデプロイ

Lambda関数のデプロイは AWS CLI ベースのセットアップスクリプトで行います。

### デプロイスクリプト一覧

| スクリプト | 用途 |
|-----------|------|
| `scripts/setup-moderation-lambda.sh` | モデレーション用Lambda（scanner + monitor）のデプロイ |
| `scripts/setup-thumbnail-lambda.sh` | サムネイル生成Lambdaのデプロイ |
| `scripts/setup-s3-notifications.sh` | S3イベント通知の統合設定（moderation + thumbnailのトリガーを一元管理） |

### デプロイ手順

```bash
# ステージング環境
./scripts/setup-moderation-lambda.sh test
./scripts/setup-thumbnail-lambda.sh test
./scripts/setup-s3-notifications.sh test   # 必ず最後に実行

# 本番環境
./scripts/setup-moderation-lambda.sh prod
./scripts/setup-thumbnail-lambda.sh prod
./scripts/setup-s3-notifications.sh prod   # 必ず最後に実行
```

**重要:** `setup-s3-notifications.sh` は必ず最後に実行してください。このスクリプトは S3 バケットの通知設定を丸ごと上書きするため、全 Lambda のトリガーを統合管理しています。個別の Lambda セットアップスクリプトを再実行した場合も、最後に `setup-s3-notifications.sh` を再実行してください。

## パスワードバリデーション規則

Issue#21 で統一されたパスワード要件：
- 8〜20文字
- 数字・小文字・大文字をそれぞれ1文字以上含む
- 記号は使用不可

正規表現: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9]{8,20}$`

## セキュリティ

- JWT トークンは localStorage に保存
- 認証が必要なエンドポイントは `Authorization: Bearer <token>` ヘッダーを使用
- Rate Limiting: 1分間に100リクエスト、10分間に500リクエスト
- パスワードは bcrypt でハッシュ化
- CSRF 保護を有効化

## デバッグ情報

### よくあるエラーと解決方法

**PostgreSQL 接続エラー:**
- Docker コンテナが起動しているか確認
- `docker-compose up -d postgres`

**CORS エラー:**
- backend の SecurityConfig で許可されているか確認
- `http://localhost:5173` がホワイトリストに含まれているか確認

**テストが失敗する:**
- テストデータベースが正しく初期化されているか確認
- `@Transactional` アノテーションが付いているか確認

## Git 管理の除外設定

`documents/` フォルダ配下のファイルは Git で管理しません（`.claude/CLAUDE.md` に設定済み）。

## 参考リソース

- [Spring Boot ドキュメント](https://spring.io/projects/spring-boot)
- [React ドキュメント](https://react.dev/)
- [Vitest ドキュメント](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**最終更新:** 2026-01-13
**プロジェクトバージョン:** MVP 開発中
