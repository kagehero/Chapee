# Mock Data Configuration

## 概要

現在、Shopee APIへの完全なアクセスが利用できない状況のため、アプリケーションはモックデータを使用するように設定されています。

将来的にAPIアクセスが可能になった場合、簡単に切り替えることができるように設計されています。

## Feature Flag

各APIエンドポイントファイルの先頭に以下のフィーチャーフラグがあります：

```typescript
// Feature flag: Set to true to use Shopee API, false to use mock data
const USE_REAL_API = false;
```

### 切り替え方法

**モックデータを使用する（現在の設定）:**
```typescript
const USE_REAL_API = false;
```

**実際のShopee APIを使用する:**
```typescript
const USE_REAL_API = true;
```

## 影響を受けるファイル

### 1. `/api/chats` - チャット一覧
**ファイル**: `app/api/chats/route.ts`

**モックデータ**: 10件のチャット会話
- 7カ国（SG, PH, MY, TW, TH, VN, BR）
- 3種類（buyer, notification, affiliate）
- 様々なステータス（active, resolved, archived）

```typescript
const MOCK_CHATS = [
  { 
    id: "conv_sg_001", 
    country: "SG", 
    customer: "Lee Wei Ming", 
    type: "buyer",
    status: "active",
    unread: 2,
    ...
  },
  // ... 他のチャット
];
```

**フィルター対応**:
- `country`: 国で絞り込み
- `status`: ステータスで絞り込み
- `type`: チャットタイプで絞り込み

### 2. `/api/chats/[id]/messages` - メッセージ取得
**ファイル**: `app/api/chats/[id]/messages/route.ts`

**モックデータ**: 会話ごとのメッセージ履歴

```typescript
const MOCK_MESSAGES = {
  "conv_sg_001": [
    { 
      id: 1, 
      sender: "customer", 
      content: "こんにちは！...", 
      time: "10:00" 
    },
    { 
      id: 2, 
      sender: "staff", 
      content: "ご注文ありがとう...", 
      time: "10:15" 
    },
    // ... 他のメッセージ
  ],
  // ... 他の会話
};
```

**サポートする会話ID**:
- `conv_sg_001` - シンガポールのバイヤー（5メッセージ）
- `conv_ph_001` - フィリピンの通知（2メッセージ）
- `conv_my_001` - マレーシアのバイヤー（2メッセージ）
- `conv_th_001` - タイのバイヤー（2メッセージ）
- `conv_vn_001` - ベトナムのアフィリエイト（3メッセージ）

### 3. `/api/shopee/sync` - データ同期
**ファイル**: `app/api/shopee/sync/route.ts`

**モードモード時の動作**:
- Shopee APIを呼び出さない
- モックデータがすでに利用可能であることを通知
- 成功レスポンスを返す

```typescript
{
  success: true,
  message: "Mock mode: Using local mock data. No sync needed.",
  results: [{
    shop_id: 1689220556,
    country: "SG",
    synced: 10,
    total: 10,
    note: "Using mock data"
  }]
}
```

## モックデータの特徴

### チャットタイプ

#### 1. Buyer（バイヤー）- 通常の顧客
- `conv_sg_001`: Lee Wei Ming（配送問い合わせ、英語混在）
- `conv_my_001`: Ahmad Farid（返品希望）
- `conv_th_001`: Somchai K.（色変更希望）
- `conv_vn_002`: Nguyen Van A（追跡番号）
- `conv_tw_001`: Chen Wei（サイズ交換）
- `conv_br_001`: Silva Santos（ポルトガル語問い合わせ）

#### 2. Notification（通知）- Shopeeシステム
- `conv_ph_001`: 返品リクエスト通知
- `conv_sg_002`: キャンセルリクエスト通知
- `conv_my_002`: 配達完了通知

#### 3. Affiliate（アフィリエイト）
- `conv_vn_001`: アフィリエイトプログラム問い合わせ

### ステータス

- **active**: 未対応、対応中
- **resolved**: 返信済み、解決済み
- **archived**: アーカイブ済み

### 未読数

- 0-3件の未読メッセージ
- アクティブな会話には未読あり
- 解決済み・アーカイブには未読なし

## 実際のAPIに切り替える手順

### ステップ1: データベース接続確認

`.env`ファイルにMongoDB接続情報が設定されていることを確認:

```env
MONGODB_URI=mongodb://...
```

### ステップ2: Shopee認証情報確認

`.env`ファイルにShopee API認証情報が設定されていることを確認:

```env
SHOPEE_PARTNER_ID=your_partner_id
SHOPEE_PARTNER_KEY=your_partner_key
SHOPEE_REDIRECT_URL=your_redirect_url
```

### ステップ3: ストア接続

1. `/settings`ページでShopeeストアを接続
2. Authorization CodeとShop IDを入力
3. トークンが正常に保存されることを確認

### ステップ4: フィーチャーフラグ変更

以下のファイルで`USE_REAL_API`を`true`に変更:

```typescript
// app/api/chats/route.ts
const USE_REAL_API = true;

// app/api/chats/[id]/messages/route.ts
const USE_REAL_API = true;

// app/api/shopee/sync/route.ts
const USE_REAL_API = true;
```

### ステップ5: テスト

1. `/dashboard`でデータ更新ボタンをクリック
2. Shopee APIから会話が同期されることを確認
3. チャット詳細ページでメッセージが表示されることを確認

## トラブルシューティング

### モックデータモードの確認

ブラウザのコンソールまたはサーバーログで以下のメッセージを確認:

```
[Chats API] Using mock data
[Messages API] Using mock data for conversation conv_sg_001
[Sync] Using mock data - skipping Shopee API call
```

### APIモードでのエラー

もし`USE_REAL_API = true`に設定してエラーが発生する場合:

1. **"Shop not connected" エラー**
   - `/settings`でストアを接続
   - MongoDBにトークンが保存されているか確認

2. **"Shopee API Error" エラー**
   - 認証情報（PARTNER_ID, PARTNER_KEY）を確認
   - トークンの有効期限を確認
   - `SHOPEE_API_DEBUG.md`を参照

3. **"Conversation not found" エラー**
   - 先に`/api/shopee/sync`で会話を同期
   - MongoDBに会話が保存されているか確認

## モックデータの拡張

新しいモックデータを追加する場合:

### チャット追加

```typescript
const MOCK_CHATS = [
  // 既存のチャット...
  { 
    id: "conv_new_001", 
    shop_id: 1689220556,
    country: "TW", 
    customer: "New Customer", 
    customer_id: 99999,
    lastMessage: "新しいメッセージ",
    time: "15:00",
    elapsed: 1.0,
    staff: "田中",
    status: "active",
    unread: 1,
    pinned: false,
    type: "buyer"
  },
];
```

### メッセージ追加

```typescript
const MOCK_MESSAGES = {
  // 既存のメッセージ...
  "conv_new_001": [
    { 
      id: 1, 
      sender: "customer", 
      content: "こんにちは", 
      time: "15:00",
      timestamp: Date.now() / 1000
    },
  ],
};

const MOCK_CONVERSATIONS = {
  // 既存の会話...
  "conv_new_001": { 
    id: "conv_new_001", 
    customer_name: "New Customer", 
    customer_id: 99999,
    country: "TW",
    shop_id: 1689220556
  },
};
```

## 本番環境での使用

**重要**: 本番環境では必ず実際のShopee APIを使用してください。

```typescript
// 本番環境での設定
const USE_REAL_API = process.env.NODE_ENV === 'production' ? true : false;
```

または環境変数で制御:

```typescript
const USE_REAL_API = process.env.USE_REAL_SHOPEE_API === 'true';
```

`.env`:
```env
USE_REAL_SHOPEE_API=true
```

## まとめ

- ✅ モックデータモード: 開発・デモ・テスト用
- ✅ APIモード: 本番環境用
- ✅ 簡単な切り替え: `USE_REAL_API`フラグ
- ✅ 3つのエンドポイントすべてに実装済み
- ✅ フィルター・検索機能も動作
- ✅ 将来的な拡張が容易

現在はモックデータモードで動作しており、Shopee APIのエラーを回避しながら、完全な機能をテストできます。
