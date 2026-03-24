import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initAdmin();
    const db = getFirestore();

    const snap = await db.collection("team_members").get();
    const members = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      count: snap.size,
      members,
      project: process.env.FIREBASE_ADMIN_PROJECT_ID,
    });
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
