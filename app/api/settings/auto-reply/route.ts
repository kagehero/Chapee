import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getCollection } from "@/lib/mongodb";

const COL = "auto_reply_settings";
const SINGLETON_ID = "singleton";

export type AutoReplyCountryStored = {
  enabled: boolean;
  triggerHour: number;
  statuses: string[];
  /** `reply_templates` のドキュメント ID */
  template_id: string;
  subAccounts?: { id: string; name: string; enabled: boolean }[];
};

type AutoReplyDoc = {
  _id: string;
  countries: Record<string, AutoReplyCountryStored>;
  updated_at?: Date;
  created_at?: Date;
};

async function requireSession() {
  const cookieStore = await cookies();
  return getSession(cookieStore);
}

/** GET /api/settings/auto-reply — 国別自動返信設定 */
export async function GET() {
  const session = await requireSession();
  if (!session.valid) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const col = await getCollection<AutoReplyDoc>(COL);
    const doc = await col.findOne({ _id: SINGLETON_ID });
    return NextResponse.json({
      countries: doc?.countries ?? {},
      updated_at: doc?.updated_at ?? null,
    });
  } catch (e) {
    console.error("[auto-reply GET]", e);
    return NextResponse.json({ error: "読み込みに失敗しました" }, { status: 500 });
  }
}

/** PUT /api/settings/auto-reply — body: { countries: Record<string, AutoReplyCountryStored> } */
export async function PUT(request: NextRequest) {
  const session = await requireSession();
  if (!session.valid) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      countries?: Record<string, AutoReplyCountryStored>;
    };
    if (!body.countries || typeof body.countries !== "object") {
      return NextResponse.json({ error: "countries が必要です" }, { status: 400 });
    }

    const col = await getCollection<AutoReplyDoc>(COL);
    await col.updateOne(
      { _id: SINGLETON_ID },
      {
        $set: {
          countries: body.countries,
          updated_at: new Date(),
        },
        $setOnInsert: {
          _id: SINGLETON_ID,
          created_at: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auto-reply PUT]", e);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
