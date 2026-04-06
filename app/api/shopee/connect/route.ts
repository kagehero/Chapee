import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/shopee-api";
import { getCollection } from "@/lib/mongodb";

/**
 * Manual token exchange endpoint for when you already have code and shop_id
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, shop_id, country } = body;

    if (!code || !shop_id) {
      return NextResponse.json(
        { error: "code と shop_id は必須です" },
        { status: 400 }
      );
    }

    const shopId = parseInt(shop_id);

    // Exchange code for access token
    const tokenData = await getAccessToken(code, shopId, {
      country: country || "SG",
    });

    // Store token in database
    const col = await getCollection<{
      shop_id: number;
      shop_name?: string;
      country: string;
      access_token: string;
      refresh_token: string;
      expires_at: Date;
      created_at: Date;
      updated_at: Date;
    }>("shopee_tokens");

    const expiresAt = new Date(Date.now() + tokenData.expire_in * 1000);

    await col.updateOne(
      { shop_id: shopId },
      {
        $set: {
          country: country || "SG",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          updated_at: new Date(),
        },
        $setOnInsert: {
          shop_id: shopId,
          shop_name: `${country || "SG"} Shop ${shopId}`,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Shopeeアカウントを接続しました",
      shop_id: shopId,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "トークン取得に失敗しました",
      },
      { status: 500 }
    );
  }
}
