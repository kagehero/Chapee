import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { defaultStaffMarketCountries } from "@/lib/shopee-markets";

type StaffDoc = {
  name: string;
  email: string;
  role: string;
  countries: string[];
  activeChats: number;
  status: "online" | "away" | "offline";
  created_at: Date;
  updated_at: Date;
};

function serialize(doc: StaffDoc & { _id: ObjectId }) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    countries: doc.countries,
    activeChats: doc.activeChats,
    status: doc.status,
  };
}

/** GET /api/staff */
export async function GET() {
  try {
    const col = await getCollection<StaffDoc>("staff_members");
    const rows = await col.find({}).sort({ created_at: -1 }).toArray();
    return NextResponse.json({
      staff: rows.map((row) => serialize(row as StaffDoc & { _id: ObjectId })),
    });
  } catch (e) {
    console.error("[staff GET]", e);
    return NextResponse.json({ error: "Failed to load staff" }, { status: 500 });
  }
}

/** POST /api/staff */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, countries } = body;
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "氏名とメールが必要です" }, { status: 400 });
    }
    const col = await getCollection<StaffDoc>("staff_members");
    const now = new Date();
    const doc: StaffDoc = {
      name: String(name).trim(),
      email: String(email).trim(),
      role: role || "オペレーター",
      countries: Array.isArray(countries) ? countries : defaultStaffMarketCountries(),
      activeChats: 0,
      status: "offline",
      created_at: now,
      updated_at: now,
    };
    const r = await col.insertOne(doc);
    const inserted = await col.findOne({ _id: r.insertedId });
    if (!inserted) throw new Error("insert failed");
    return NextResponse.json({
      staff: serialize(inserted as unknown as StaffDoc & { _id: ObjectId }),
    });
  } catch (e) {
    console.error("[staff POST]", e);
    return NextResponse.json({ error: "Failed to add staff" }, { status: 500 });
  }
}

/** DELETE /api/staff?id= */
export async function DELETE(request: NextRequest) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const col = await getCollection("staff_members");
    await col.deleteOne({ _id: new ObjectId(id) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[staff DELETE]", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
