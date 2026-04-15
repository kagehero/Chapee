# Chapee

Shopee セラー向けのチャット管理 Web アプリケーション（Next.js）。会話一覧・メッセージ送受信・自動返信・翻訳・対応ステータスなどを提供します。

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js（App Router） |
| 言語 | TypeScript |
| データベース | MongoDB（公式ドライバ） |
| 認証 | JWT（Cookie `auth-token`）+ bcrypt |
| スタイル | Tailwind CSS、Radix UI |

## 前提条件

- **Node.js** 20 系推奨（`package.json` の engines が無い場合は 18+ で動作確認）
- **MongoDB** 接続済みインスタンス（Atlas 等）
- **Shopee Open Platform** の Partner ID / Partner Key、および OAuth 用リダイレクト URL 登録

## ローカル開発

```bash
npm install
cp .env.example .env
# .env を編集（MongoDB URI、AUTH_SECRET、Shopee キー等）
npm run dev
```

ブラウザで `http://localhost:3000` を開き、登録・ログイン後に `/dashboard` へ遷移します。

## ビルド・本番起動

```bash
npm run build
npm run start
```

## ドキュメント（クライアント・引き継ぎ用）

| ドキュメント | 内容 |
|--------------|------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | 本番デプロイ、環境変数、Vercel / MongoDB、Webhook・Cron |
| [docs/HANDOVER.md](docs/HANDOVER.md) | システム構成、主要データ、外部サービス、検証チェックリスト |
| [docs/MONGODB_SCHEMA.md](docs/MONGODB_SCHEMA.md) | **MongoDB コレクション別フィールド定義**（アプリ準拠） |
| [docs/FEATURE_SPEC.md](docs/FEATURE_SPEC.md) | **画面一覧・遷移・API エンドポイント一覧**（機能仕様） |
| [.env.example](.env.example) | 環境変数テンプレート（秘密値は実値を入れずに配布） |

## 補足

- Shopee 連携の実装メモは [README_SHOPEE.md](README_SHOPEE.md) にありますが、一部の Cron 記述は本番の `vercel.json` と異なる場合があります。**最新の運用は `vercel.json` と `docs/DEPLOYMENT.md` を参照**してください。
