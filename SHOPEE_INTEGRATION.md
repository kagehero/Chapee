# Shopee API Integration for Chapee

This document explains how to integrate your Singapore Shopee store with the Chapee chat management system.

## Setup Instructions

### 1. Get Your Shopee Credentials

1. Go to [Shopee Open Platform](https://open.shopee.com/)
2. Register as a developer and create an app
3. Get your **Partner ID** and **Partner Key**
4. Note down the authorization **code** and **shop_id** from your Singapore store

### 2. Configure Environment Variables

Edit your `.env` file and add:

```env
SHOPEE_PARTNER_ID=your_partner_id_here
SHOPEE_PARTNER_KEY=your_partner_key_here
SHOPEE_REDIRECT_URL=http://localhost:3000/api/shopee/callback
```

### 3. Connect Your Store

#### Option A: Using the Settings Page (Recommended)

1. Start your development server: `npm run dev`
2. Login to Chapee
3. Navigate to **設定 (Settings)** from the sidebar
4. Enter your authorization **code** and **shop_id**
5. Click **アカウント接続 (Connect Account)**

#### Option B: Using API Directly

```bash
curl -X POST http://localhost:3000/api/shopee/connect \
  -H "Content-Type: application/json" \
  -d '{
    "code": "your_authorization_code",
    "shop_id": your_shop_id
  }'
```

### 4. Token Storage

Tokens are stored in MongoDB in the `shopee_tokens` collection with the following schema:

```typescript
{
  shop_id: number,           // Shopee shop ID
  shop_name: string,         // Shop name (from API)
  country: string,           // "SG" for Singapore
  access_token: string,      // Active access token
  refresh_token: string,     // Refresh token
  expires_at: Date,          // Token expiration timestamp
  created_at: Date,          // First connection time
  updated_at: Date           // Last token refresh time
}
```

## API Endpoints

### POST `/api/shopee/connect`

Exchange authorization code for access token.

**Body:**
```json
{
  "code": "authorization_code_from_shopee",
  "shop_id": 12345678
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shopeeアカウントを接続しました",
  "shop_id": 12345678,
  "expires_at": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/shopee/callback`

OAuth callback endpoint (used when redirecting from Shopee authorization).

**Query params:**
- `code`: Authorization code
- `shop_id`: Shop ID

### GET `/api/shopee/status`

Get all connected Shopee accounts.

**Response:**
```json
{
  "connections": [
    {
      "shop_id": 12345678,
      "shop_name": "My Singapore Shop",
      "country": "SG",
      "expires_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2023-12-01T00:00:00.000Z"
    }
  ]
}
```

## Available Shopee API Functions

Located in `src/lib/shopee-api.ts`:

### `getAccessToken(code, shopId)`
Exchange authorization code for access token.

### `refreshAccessToken(refreshToken, shopId)`
Refresh an expired access token.

### `getShopInfo(accessToken, shopId)`
Get shop information (name, description, etc.).

### `getConversations(accessToken, shopId, params?)`
Get customer chat conversations.

**Params:**
- `conversation_id`: Filter by conversation
- `direction`: "next" or "previous" for pagination
- `type`: "all", "unread", or "pinned"
- `page_size`: Number of conversations to fetch

### `sendMessage(accessToken, shopId, conversationId, message)`
Send a message to a customer.

### `generateShopAuthUrl(redirectUrl)`
Generate OAuth authorization URL for shop owner to authorize the app.

## Token Refresh

Tokens expire after a certain period. Implement automatic refresh:

```typescript
import { refreshAccessToken } from '@/lib/shopee-api';
import { getCollection } from '@/lib/mongodb';

async function ensureValidToken(shopId: number) {
  const col = await getCollection('shopee_tokens');
  const token = await col.findOne({ shop_id: shopId });
  
  if (!token) throw new Error('Shop not connected');
  
  // Check if token expires in next 24 hours
  const expiresIn = token.expires_at.getTime() - Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  if (expiresIn < oneDayMs) {
    // Refresh token
    const newToken = await refreshAccessToken(token.refresh_token, shopId);
    await col.updateOne(
      { shop_id: shopId },
      {
        $set: {
          access_token: newToken.access_token,
          refresh_token: newToken.refresh_token,
          expires_at: new Date(Date.now() + newToken.expire_in * 1000),
          updated_at: new Date(),
        },
      }
    );
    return newToken.access_token;
  }
  
  return token.access_token;
}
```

## Next Steps

1. **Fetch Conversations**: Create an endpoint to sync Shopee conversations with your dashboard
2. **Send Messages**: Integrate send message functionality in chat detail page
3. **Webhooks**: Set up Shopee webhooks to receive real-time message notifications
4. **Auto-reply**: Connect auto-reply rules to Shopee messages
5. **Multi-country**: Add support for additional countries (PH, MY, TH, ID, VN)

## Troubleshooting

### "Invalid signature" error
- Verify your Partner ID and Partner Key are correct
- Check timestamp is in seconds (not milliseconds)
- Ensure signature generation follows exact Shopee format

### "Token expired" error
- Implement token refresh before making API calls
- Store and use the refresh token from initial authorization

### "Shop not authorized" error
- Ensure shop owner has authorized your app via the auth URL
- Check redirect URL matches exactly with registered URL

## Documentation

- [Shopee Open Platform Docs](https://open.shopee.com/documents)
- [Authentication Guide](https://open.shopee.com/documents?module=63&type=1&id=53&version=2)
- [Seller Chat API](https://open.shopee.com/documents?module=108&type=1&id=706&version=2)
