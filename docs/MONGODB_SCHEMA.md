# MongoDB スキーマ定義（アプリ準拠）

## 重要な前提

- MongoDB は**コレクションごとにスキーマを強制しない**（スキーマレス）です。
- 以下は **Chapee の TypeScript コードおよび `$set` / `insert` から読み取れる「実質的なフィールド定義」**です。未使用フィールドや歴史的なドキュメントには、記載外のキーが残っている可能性があります。
- 主キーは原則 **`_id`**（MongoDB の `ObjectId`）。例外は **`_id: "singleton"`** のドキュメント（設定系）。

---

## 1. `users` — アプリログインユーザー

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `_id` | ObjectId | 自動 | ドキュメント ID |
| `email` | string | ○ | 小文字で保存 |
| `password` | string | ○ | bcrypt ハッシュ |
| `name` | string | ○ | 表示名 |
| `createdAt` | Date | ○ | 登録日時 |

---

## 2. `shopee_tokens` — Shopee OAuth トークン（店舗単位）

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `_id` | ObjectId | 自動 | |
| `shop_id` | number | ○ | Shopee 店舗 ID（検索キー） |
| `shop_name` | string | | 店舗名 |
| `country` | string | ○ | マーケット（例: SG, MY） |
| `access_token` | string | ○ | アクセストークン |
| `refresh_token` | string | ○ | リフレッシュトークン |
| `expires_at` | Date | ○ | アクセストークン期限 |
| `created_at` | Date | | 初回 upsert 時 |
| `updated_at` | Date | | 更新日時 |

**インデックス推奨:** `shop_id` ユニーク（運用で重複防止）。

---

## 3. `shopee_conversations` — 会話メタデータ（Shopee 同期）

1 会話 = 1 ドキュメント。**複合キー:** `conversation_id` + `shop_id`。

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | ObjectId | 自動 |
| `conversation_id` | string | Shopee 会話 ID |
| `shop_id` | number | 店舗 ID |
| `country` | string | マーケット |
| `customer_id` | number | バイヤーユーザー ID（送信先） |
| `customer_name` | string | 表示名 |
| `customer_avatar_url` | string | 任意 |
| `last_message` | string | 一覧用プレビュー文 |
| `last_message_time` | Date | 最終メッセージ時刻 |
| `last_message_type` | string | Shopee のメッセージ種別 |
| `last_buyer_message_time` | Date | バイヤー最終発言時刻（対応ステータス用） |
| `chat_type` | `"buyer"` \| `"notification"` \| `"affiliate"` | 会話種別 |
| `unread_count` | number | 未読件数 |
| `pinned` | boolean | ピン留め |
| `status` | string | 例: `active` / `resolved` / `archived` |
| `handling_status` | string | `unreplied` / `auto_replied_pending` / `in_progress` / `completed` |
| `assigned_staff` | string | 担当者表示（任意） |
| `staff_message_kind_log` | `{ id: string; kind: string }[]` | 店舗送信メッセージの種別ログ（最大約120件、`kind`: `manual` \| `template` \| `auto`） |
| `auto_reply_pending` | boolean | 自動返信待ち |
| `auto_reply_due_at` | Date \| null | 自動返信予定時刻 |
| `last_auto_reply_at` | Date \| null | 最終自動返信送信時刻 |
| `created_at` | Date | |
| `updated_at` | Date | |

---

## 4. `shopee_chat_messages` — メッセージ raw キャッシュ（Webhook 同期）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | ObjectId | 自動 |
| `conversation_id` | string | |
| `shop_id` | number | |
| `message_id` | string | Shopee メッセージ ID |
| `raw` | object | Shopee API のメッセージ行そのまま |
| `timestamp_ms` | number | 並び替え・表示用（ミリ秒） |
| `synced_at` | Date | DB 投入時刻 |

**複合キー想定:** `conversation_id` + `shop_id` + `message_id`。

---

## 5. `shopee_sync_snapshots` — 同期デルタ検出

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | ObjectId | 自動 |
| `shop_id` | number | 店舗単位で 1 ドキュメント想定 |
| `conv_last_ts` | object | キー: `conversation_id`（string）、値: 直近の `last_message_timestamp`（string） |
| `notification_ids` | string[] | Seller Center 通知 ID のスナップショット |
| `updated_at` | Date | |

---

## 6. `auto_reply_settings` — 自動返信（シングルトン）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | `"singleton"` | 固定 |
| `countries` | object | キーは国コード（例: SG, MY）。値は下表 `AutoReplyCountry` |
| `created_at` | Date | |
| `updated_at` | Date | |

**`AutoReplyCountry`（各値）:**

| フィールド | 型 | 説明 |
|------------|-----|------|
| `enabled` | boolean | |
| `triggerHour` | number | バイヤー最終メッセージから何時間後に送るか |
| `template_id` | string | `reply_templates` の `_id`（文字列） |
| `subAccounts` | `{ id, name, enabled }[]` | 任意 |

---

## 7. `reply_templates` — 返信テンプレート

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | ObjectId | |
| `country` | string | 例: `全て`, `MY` |
| `category` | string | UI 分類 |
| `name` | string | テンプレ名 |
| `content` | string | 本文 |
| `autoReply` | boolean | 自動返信候補か |
| `langs` | string[] | 例: `["JA","EN"]` |
| `created_at` | Date | |
| `updated_at` | Date | |

---

## 8. `translation_settings` — 翻訳設定（シングルトン）

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | `"singleton"` | 固定 |
| `history_provider` | `"deepl"` \| `"google"` | メッセージ履歴翻訳のエンジン |
| `input_provider` | `"deepl"` \| `"google"` | 入力欄翻訳のエンジン |
| `deepl_api_key` | string \| null | DB 保存（空なら環境変数フォールバック可） |
| `google_api_key` | string \| null | 同上 |
| `updated_at` | Date | |

---

## 9. `staff_members` — 担当者マスタ

| フィールド | 型 | 説明 |
|------------|-----|------|
| `_id` | ObjectId | |
| `name` | string | |
| `email` | string | |
| `role` | string | |
| `countries` | string[] | 担当国コード |
| `activeChats` | number | 表示用カウンタ |
| `status` | `"online"` \| `"away"` \| `"offline"` | |
| `created_at` | Date | |
| `updated_at` | Date | |

---

## 10. その他（参考）

本リポジトリのコードが直接触る主なコレクションは上記です。バージョンにより追加される場合は、コード内の `getCollection("…")` を検索してください。

---

## 改訂

スキーマ変更時は本書と `docs/HANDOVER.md` を更新してください。
