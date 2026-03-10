import { NextRequest, NextResponse } from "next/server";
import { getConversations } from "@/lib/shopee-api";
import { getValidToken, getConnectedShops } from "@/lib/shopee-token";
import { getCollection } from "@/lib/mongodb";

type ShopeeMessage = {
  message_id: string;
  message: string;
  timestamp: number;
  from_id: number;
  to_id: number;
  message_type: number;
};

type ShopeeConversation = {
  conversation_id: string;
  to_id: number;
  to_name: string;
  last_read_message_id: string;
  unread_count: number;
  pinned: boolean;
  last_message_timestamp: number;
  last_message_type: string;
  max_general_option_list?: unknown[];
};

/**
 * Sync Shopee conversations to database
 * GET /api/shopee/sync?shop_id=123 (specific shop)
 * GET /api/shopee/sync (all shops)
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[Sync] Starting conversation sync...");
    
    const { searchParams } = new URL(request.url);
    const shopIdParam = searchParams.get("shop_id");

    let shopsToSync: { shop_id: number; country: string }[];

    if (shopIdParam) {
      // Sync specific shop
      const shopId = parseInt(shopIdParam);
      const shops = await getConnectedShops();
      const shop = shops.find((s) => s.shop_id === shopId);
      if (!shop) {
        return NextResponse.json(
          { error: "Shop not found" },
          { status: 404 }
        );
      }
      shopsToSync = [{ shop_id: shopId, country: shop.country }];
    } else {
      // Sync all connected shops
      const shops = await getConnectedShops();
      console.log(`[Sync] Found ${shops.length} connected shops`);
      
      if (shops.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No shops connected. Please connect a shop in Settings.",
          results: [],
        });
      }
      
      shopsToSync = shops.map((s) => ({
        shop_id: s.shop_id,
        country: s.country,
      }));
    }

    const results = [];

    for (const shop of shopsToSync) {
      try {
        console.log(`[Sync] Syncing shop ${shop.shop_id} (${shop.country})...`);
        const accessToken = await getValidToken(shop.shop_id);
        console.log(`[Sync] Got access token for shop ${shop.shop_id}`);

        // Fetch conversations from Shopee
        const response = await getConversations(accessToken, shop.shop_id, {
          page_size: 50,
        });

        console.log(`[Sync] API Response:`, JSON.stringify(response, null, 2));

        const conversations: ShopeeConversation[] =
          response.response?.conversation_list || [];

        console.log(`[Sync] Found ${conversations.length} conversations for shop ${shop.shop_id}`);

        // Store in database
        const col = await getCollection<{
          conversation_id: string;
          shop_id: number;
          country: string;
          customer_id: number;
          customer_name: string;
          last_message: string;
          last_message_time: Date;
          unread_count: number;
          pinned: boolean;
          status: "active" | "resolved" | "archived";
          assigned_staff?: string;
          created_at: Date;
          updated_at: Date;
        }>("shopee_conversations");

        let synced = 0;

        for (const conv of conversations) {
          await col.updateOne(
            {
              conversation_id: conv.conversation_id,
              shop_id: shop.shop_id,
            },
            {
              $set: {
                country: shop.country,
                customer_id: conv.to_id,
                customer_name: conv.to_name,
                last_message: `[${conv.last_message_type}]`, // Message type only for now
                last_message_time: new Date(conv.last_message_timestamp * 1000),
                unread_count: conv.unread_count,
                pinned: conv.pinned,
                status: conv.unread_count > 0 ? "active" : "resolved",
                updated_at: new Date(),
              },
              $setOnInsert: {
                conversation_id: conv.conversation_id,
                shop_id: shop.shop_id,
                created_at: new Date(),
              },
            },
            { upsert: true }
          );
          synced++;
        }

        console.log(`[Sync] Synced ${synced} conversations to database`);

        results.push({
          shop_id: shop.shop_id,
          country: shop.country,
          synced,
          total: conversations.length,
        });
      } catch (error) {
        console.error(`[Sync] Failed to sync shop ${shop.shop_id}:`, error);
        results.push({
          shop_id: shop.shop_id,
          country: shop.country,
          error: error instanceof Error ? error.message : "Sync failed",
        });
      }
    }

    console.log("[Sync] Sync complete. Results:", results);

    return NextResponse.json({
      success: true,
      message: "Conversations synced",
      results,
    });
  } catch (error) {
    console.error("[Sync] Sync error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopee/sync - Trigger manual sync
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
