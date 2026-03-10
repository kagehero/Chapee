import { NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

/**
 * Get status of Shopee connections
 */
export async function GET(request: NextRequest) {
  try {
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

    const connections = await col
      .find({})
      .project({
        shop_id: 1,
        shop_name: 1,
        country: 1,
        expires_at: 1,
        updated_at: 1,
      })
      .toArray();

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "ステータス取得に失敗しました" },
      { status: 500 }
    );
  }
}
