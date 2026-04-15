# 引き継ぎ資料（Chapee）

第三者が**アーキテクチャを把握し、手順に沿って環境を再現・保守できる**ことを目的とした概要です。詳細な API 仕様は Shopee / MongoDB / Vercel の公式ドキュメントを参照してください。

## 1. システム構成（論理）

```
[ユーザー] → HTTPS → [Vercel: Next.js]
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    [MongoDB Atlas]  [Shopee Partner API]  [DeepL / Google]（任意）
```

- **フロント**: Next.js App Router（`app/` 配下）。認証必須ルートは `src/middleware.ts` で保護。
- **API**: `app/api/**` の Route Handlers。サーバー側で Shopee・MongoDB にアクセス。
- **バックグラウンド**: Vercel Cron または外部 Cron で `GET /api/cron/auto-reply` 等を呼び出し。

## 2. 主要機能（ユーザー向け）

| 機能 | 概要 |
|------|------|
| 認証 | 登録・ログイン（`users` コレクション）、JWT Cookie |
| チャット一覧 | MongoDB の `shopee_conversations` を中心に表示。国・対応ステータスでフィルタ |
| チャット詳細 | Shopee `get_message` 等でメッセージ取得・送信 |
| 同期 | `POST /api/shopee/sync` で会話一覧を Shopee と突き合わせ |
| 自動返信 | 設定した時間経過後にテンプレート送信。Cron + DB の `auto_reply_pending` |
| 翻訳 | DeepL / Google（設定 UI + 環境変数フォールバック） |
| Webhook | `POST /api/shopee/webhook` で新着をトリガに同期 |

## 3. MongoDB コレクション（主要）

| コレクション名 | 用途 |
|----------------|------|
| `users` | アプリログインユーザー |
| `shopee_conversations` | 会話のメタデータ（最終メッセージ、未読、対応ステータス等） |
| `shopee_chat_messages` | Webhook 同期時のメッセージ raw キャッシュ（任意） |
| `shopee_tokens` | 店舗 OAuth トークン・リフレッシュ |
| `shopee_sync_snapshots` | 同期デルタ検出用スナップショット |
| `auto_reply_settings` | 自動返信設定（国別） |
| `reply_templates` | 返信テンプレート |
| `translation_settings` | 翻訳プロバイダ・API キー（DB 保存） |
| `staff_members` | 担当者マスタ（UI 用） |

※ スキーマは**アプリ側で型定義**されており、MongoDB はスキーマレスです。実際のフィールドはコード内の `getCollection` 型を参照してください。

## 4. 環境変数

本番は Vercel の Environment Variables に設定。テンプレートはリポジトリの `.env.example` を参照。

## 5. 外部サービス一覧

| サービス | 用途 | 備考 |
|----------|------|------|
| Shopee Open Platform | チャット・注文・商品等 API | Partner ID/Key、OAuth、Webhook |
| MongoDB Atlas | アプリデータ永続化 | |
| Vercel（想定） | ホスティング・Cron | |
| DeepL / Google Cloud Translation | メッセージ翻訳 | 任意。設定画面または環境変数 |

**決済・メール送信**専用の外部サービスは本プロジェクトの標準構成には含まれていません（該当する場合は個別契約に依存）。

## 6. 認証・セキュリティの注意

- `AUTH_SECRET` は本番で必ず強力なランダム値に。
- `CRON_SECRET` を設定し、Cron 用 API を `Authorization: Bearer` で保護。
- `.env` はリポジトリにコミットしない。引き継ぎ時は安全なチャネルで渡す。

## 7. 検証チェックリスト（引き継ぎ後）

- [ ] `npm run build` がローカルで成功する
- [ ] 本番 URL でログイン・ログアウトできる
- [ ] Shopee 店舗連携が完了し、会話が表示される
- [ ] メッセージ送信が Shopee 側に反映される
- [ ] `POST /api/shopee/sync` が成功する（401/500 でない）
- [ ] Cron（自動返信）が期待どおり動くか（ログ確認）
- [ ] Webhook が届く場合、新着が反映されるか

## 8. 関連ドキュメント

- [画面仕様・API 一覧（FEATURE_SPEC.md）](./FEATURE_SPEC.md) — 画面 URL、遷移図、全 API エンドポイント

## 9. ドキュメント更新履歴

運用ルールやインフラ変更時は、本 README / `DEPLOYMENT.md` / `HANDOVER.md` / `FEATURE_SPEC.md` を更新してください。
