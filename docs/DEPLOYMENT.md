# デプロイ手順書（Chapee）

本書は、**本番環境を新規に構築する**、または**第三者が同じ手順で再現する**ことを想定した手順です。

## 1. 概要

| 項目 | 推奨 |
|------|------|
| アプリホスティング | Vercel（Next.js ネイティブ対応） |
| データベース | MongoDB Atlas |
| ドメイン | Vercel ドメイン設定、または DNS で CNAME |
| 外部 API | Shopee Open Platform、DeepL / Google（翻訳・任意） |

## 2. MongoDB Atlas

1. [MongoDB Atlas](https://www.mongodb.com/atlas) でプロジェクト・クラスタを作成。
2. **Database Access** でユーザー作成（ユーザー名・パスワード）。
3. **Network Access** で接続元を許可。Vercel からの接続の場合は **0.0.0.0/0**（全世界）を許可するか、Vercel の固定 IP 機能を利用するか運用方針に合わせて設定。
4. **Connect** → アプリ用に **URI** をコピー。`<password>` 部分を実パスワードに置換。
5. 環境変数 `MONGODB_URI` に設定。データベース名は `MONGODB_DB`（例: `chapee`）で指定。

## 3. Vercel へのデプロイ

1. GitHub 等にリポジトリをプッシュし、[Vercel](https://vercel.com) で **Import**。
2. **Framework Preset**: Next.js（自動検出）。
3. **Build Command**: `npm run build`（既定）、**Output**: 既定。
4. **Environment Variables** に、リポジトリの `.env.example` を参照し、本番値をすべて入力（後述「環境変数一覧」）。
5. **Deploy** 実行。

### カスタムドメイン

Vercel プロジェクトの **Settings → Domains** でドメインを追加し、DNS プロバイダ側で CNAME / A レコードを指示どおり設定。

## 4. 環境変数一覧（必須・任意）

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `MONGODB_URI` | 必須 | MongoDB 接続 URI |
| `MONGODB_DB` | 任意 | DB 名。未設定時は `chapee` |
| `AUTH_SECRET` | 強く推奨 | JWT 署名用。未設定時は開発用デフォルトが使われ**本番では危険** |
| `SHOPEE_PARTNER_ID` | 必須 | Shopee Partner ID |
| `SHOPEE_PARTNER_KEY` | 必須 | Shopee Partner Key |
| `SHOPEE_REDIRECT_URL` | 必須 | OAuth 成功後のリダイレクト先。**Shopee コンソールの Redirect URL と完全一致**（末尾スラッシュ含む） |
| `CRON_SECRET` | 強く推奨 | Cron 用 API の `Authorization: Bearer` 用。未設定だと Cron エンドポイントが無防備になる可能性 |
| `SHOPEE_PARTNER_API_HOST` | 任意 | Partner API ベース URL を上書き |
| `SHOPEE_PARTNER_API_ENV` | 任意 | `sandbox` / `test-stable` 等（テスト環境用） |
| `SHOPEE_PARTNERS_JSON` | 任意 | 複数国パートナー設定（1行 JSON） |
| `DEEPL_API_KEY` | 任意 | DeepL（DB 未設定時のフォールバック） |
| `DEEPL_API_URL` | 任意 | 既定: `https://api-free.deepl.com` |
| `GOOGLE_TRANSLATE_API_KEY` | 任意 | Google 翻訳（同上） |

## 5. Shopee Open Platform の設定

1. [Shopee Open Platform](https://open.shopee.com/) でアプリを作成。
2. **Redirect URL** に `https://<your-domain>/api/shopee/callback`（`SHOPEE_REDIRECT_URL` と同一）を登録。
3. **Webhook URL** に `https://<your-domain>/api/shopee/webhook` を登録（チャットのプッシュ受信用）。
4. チャット関連の Push（例: `webchat_push` code 10）を有効化。

## 6. Cron（Vercel）

リポジトリの `vercel.json` に定義されている Cron を確認。デプロイ後、Vercel の **Settings → Cron Jobs** で実行状況を確認。

### 主なエンドポイント（認証）

- `GET /api/cron/auto-reply` … 期限到来の自動返信送信。`Authorization: Bearer ${CRON_SECRET}`（`CRON_SECRET` 設定時）。
- `GET /api/shopee/refresh-tokens` … トークン更新。同様に Bearer 保護（実装を確認）。
- `POST /api/shopee/sync` … 会話同期（ダッシュボード・手動から呼び出し）。

**注意:** `vercel.json` に **トークン更新** 用の Cron が未記載の場合は、外部スケジューラ（cron-job.org 等）から同 URL を定期呼び出しするか、`vercel.json` にエントリを追加してください。

## 7. デプロイ後の検証

1. `https://<your-domain>/login` にアクセスし、ログインできること。
2. 設定で Shopee 連携（OAuth）が完了し、ダッシュボードで会話が表示されること。
3. `POST /api/shopee/sync`（手動またはダッシュボード）で同期が成功すること。
4. チャット詳細でメッセージ取得・送信ができること。
5. Webhook（任意）: テストメッセージ送信後、ログまたは DB で反映を確認。

## 8. トラブルシューティング

| 現象 | 確認 |
|------|------|
| MongoDB 接続エラー | `MONGODB_URI`、IP 許可、ユーザー権限 |
| Shopee OAuth 失敗 | Redirect URL の完全一致（`http`/`https`、末尾 `/`） |
| 401 on Cron | `CRON_SECRET` と `Authorization` ヘッダ |
| チャットが空 | トークン期限・`GET /api/shopee/sync`・Webhook 到達性 |

## 9. 本番データのバックアップ

MongoDB Atlas の **Snapshot** または **mongodump** で定期バックアップを推奨。手順は Atlas ドキュメントに従う。
