import { NextRequest, NextResponse } from "next/server";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { sendEmail, buildDailyDigestHtml } from "@/lib/email";
import { initAdmin } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initAdmin();
    const db = getFirestore();

    const teamSnap = await db
      .collection("team_members")
      .where("status", "==", "active")
      .get();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const results: Array<{ email: string; success: boolean; id?: string; error?: string }> = [];

    for (const memberDoc of teamSnap.docs) {
      const member = memberDoc.data() as {
        email?: string;
        name?: string;
        displayName?: string;
        uid?: string;
      };
      if (!member.email) continue;
      const memberUid = member.uid || memberDoc.id;
      const memberName = member.name || member.displayName || "";

      const activitiesSnap = await db
        .collection("activities")
        .where("createdAt", ">=", Timestamp.fromDate(yesterday))
        .where("createdAt", "<=", Timestamp.fromDate(yesterdayEnd))
        .get();

      const allActivities = activitiesSnap.docs.map(
        (d) => d.data() as { type?: string; createdByName?: string; createdBy?: string }
      );
      const memberActivities = allActivities.filter(
        (a) => a.createdBy === memberUid || a.createdByName === memberName
      );

      const contactsMade = memberActivities.filter(
        (a) => a.type === "Call" || a.type === "Contact Made"
      ).length;
      const siteVisits = memberActivities.filter(
        (a) => a.type === "Site Visit" || a.type === "Meeting"
      ).length;
      const followUps = memberActivities.filter((a) => a.type === "Follow Up").length;

      const leadsSnap = await db
        .collection("leads")
        .where("assignedTo", "==", memberName)
        .where("status", "in", ["new", "contacted", "qualified"])
        .get();
      const openLeads = leadsSnap.size;
      const pipelineValue = leadsSnap.docs.reduce(
        (sum, d) => sum + Number((d.data() as { value?: number }).value ?? 0),
        0
      );

      const firstName = (member.name || member.displayName || "there").split(" ")[0];
      const html = buildDailyDigestHtml({
        firstName,
        contactsMade,
        siteVisits,
        followUps,
        openLeads,
        pipelineValue,
        streakDays: 0,
      });

      const result = await sendEmail({
        to: member.email,
        subject: `Good morning ${firstName} — your Bayan CRM digest ☀️`,
        html,
      });

      results.push({ email: member.email, ...result });
    }

    return NextResponse.json({ sent: results.length, results });
  } catch (err: unknown) {
    console.error("Daily digest error:", err);
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
