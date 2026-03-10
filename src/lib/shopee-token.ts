import { getCollection } from "@/lib/mongodb";
import { refreshAccessToken } from "./shopee-api";

/**
 * Get valid access token for a shop, refreshing if needed
 */
export async function getValidToken(shopId: number): Promise<string> {
  const col = await getCollection<{
    shop_id: number;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }>("shopee_tokens");

  const token = await col.findOne({ shop_id: shopId });

  if (!token) {
    console.error(`[Token] Shop ${shopId} not connected in database`);
    throw new Error(`Shop ${shopId} not connected`);
  }

  console.log(`[Token] Found token for shop ${shopId}`);
  console.log(`[Token] Expires at: ${token.expires_at}`);
  console.log(`[Token] Current time: ${new Date()}`);

  // Check if token expires in next 24 hours
  const expiresIn = token.expires_at.getTime() - Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;

  console.log(`[Token] Expires in: ${Math.floor(expiresIn / 1000 / 60)} minutes`);

  if (expiresIn < oneDayMs) {
    console.log(`[Token] Token expiring soon, refreshing for shop ${shopId}...`);
    
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
    
    console.log(`[Token] Successfully refreshed token for shop ${shopId}`);
    return newToken.access_token;
  }

  console.log(`[Token] Using existing token for shop ${shopId}`);
  return token.access_token;
}

/**
 * Get all connected shops
 */
export async function getConnectedShops() {
  const col = await getCollection<{
    shop_id: number;
    shop_name?: string;
    country: string;
    access_token: string;
    refresh_token: string;
    expires_at: Date;
  }>("shopee_tokens");

  return await col.find({}).toArray();
}

/**
 * Refresh all tokens that are expiring soon (background job)
 */
export async function refreshAllExpiringTokens() {
  const shops = await getConnectedShops();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const results = [];

  for (const shop of shops) {
    const expiresIn = shop.expires_at.getTime() - now;
    
    if (expiresIn < oneDayMs) {
      try {
        await getValidToken(shop.shop_id);
        results.push({ shop_id: shop.shop_id, status: "refreshed" });
      } catch (error) {
        console.error(`Failed to refresh token for shop ${shop.shop_id}:`, error);
        results.push({
          shop_id: shop.shop_id,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } else {
      results.push({ shop_id: shop.shop_id, status: "valid" });
    }
  }

  return results;
}
