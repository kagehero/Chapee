import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";

type TemplateDoc = {
  country: string;
  category: string;
  name: string;
  content: string;
  autoReply: boolean;
  langs: string[];
  created_at: Date;
  updated_at: Date;
};

const DEFAULT_TEMPLATES: Omit<TemplateDoc, "created_at" | "updated_at">[] = [
  {
    country: "全て",
    category: "発送前",
    name: "発送準備中のご案内",
    content:
      "この度はご注文いただきありがとうございます。現在、ご注文商品の発送準備を進めております。出荷後、追跡番号をお知らせいたします。",
    autoReply: true,
    langs: ["JA", "EN"],
  },
  {
    country: "SG",
    category: "発送前",
    name: "追跡番号のご案内",
    content:
      "ご注文の商品が発送されました。追跡番号：[TRACKING_NUMBER] にてご確認いただけます。",
    autoReply: false,
    langs: ["EN"],
  },
  {
    country: "全て",
    category: "配達後",
    name: "受取確認のお願い",
    content:
      "商品はお受け取りいただけましたでしょうか？問題がございましたら、お気軽にご連絡ください。",
    autoReply: false,
    langs: ["JA", "EN", "ZH"],
  },
  {
    country: "MY",
    category: "配達後",
    name: "レビューのお願い",
    content:
      "この度はお買い上げいただきありがとうございます。商品はいかがでしたでしょうか？ぜひレビューをお寄せください。",
    autoReply: false,
    langs: ["EN", "MS"],
  },
  {
    country: "全て",
    category: "返品・交換",
    name: "返品対応案内",
    content:
      "ご不便をおかけして申し訳ございません。返品・交換は注文日から14日以内に承っております。",
    autoReply: false,
    langs: ["JA", "EN"],
  },
  {
    country: "全て",
    category: "自動返信",
    name: "営業時間外の自動返信",
    content:
      "お問い合わせありがとうございます。現在、営業時間外です。翌営業日（9:00〜18:00）にご対応いたします。",
    autoReply: true,
    langs: ["JA", "EN"],
  },
];

function serialize(doc: TemplateDoc & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    country: doc.country,
    category: doc.category,
    name: doc.name,
    content: doc.content,
    autoReply: doc.autoReply,
    langs: doc.langs,
  };
}

async function ensureSeeded() {
  const col = await getCollection<TemplateDoc>("reply_templates");
  const n = await col.countDocuments();
  if (n > 0) return col;
  const now = new Date();
  const docs: TemplateDoc[] = DEFAULT_TEMPLATES.map((t) => ({
    ...t,
    created_at: now,
    updated_at: now,
  }));
  await col.insertMany(docs);
  return col;
}

/** GET /api/reply-templates */
export async function GET() {
  try {
    const col = await ensureSeeded();
    const rows = await col.find({}).sort({ created_at: 1 }).toArray();
    return NextResponse.json({ templates: rows.map(serialize) });
  } catch (e) {
    console.error("[reply-templates GET]", e);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}

/** PATCH /api/reply-templates — body: { id, content } */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content } = body;
    if (!id || typeof content !== "string") {
      return NextResponse.json({ error: "id と content が必要です" }, { status: 400 });
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const col = await getCollection<TemplateDoc & { _id: ObjectId }>("reply_templates");
    const now = new Date();
    const oid = new ObjectId(id);
    const up = await col.updateOne(
      { _id: oid },
      { $set: { content, updated_at: now } }
    );
    if (up.matchedCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await col.findOne({ _id: oid });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ template: serialize(updated) });
  } catch (e) {
    console.error("[reply-templates PATCH]", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

/** DELETE /api/reply-templates?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const col = await getCollection("reply_templates");
    await col.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reply-templates DELETE]", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
