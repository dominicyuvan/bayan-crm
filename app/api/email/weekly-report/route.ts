import { NextRequest, NextResponse } from "next/server";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { sendEmail, buildWeeklyReportHtml } from "@/lib/email";
import { initAdmin } from "@/lib/firebase-admin";

type ActivityRow = { createdBy?: string; type?: string };
type LeadRow = {
  assignedToUid?: string;
  value?: number;
  updatedAt?: { toDate?: () => Date };
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initAdmin();
    const db = getFirestore();

    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const teamSnap = await db
      .collection("team_members")
      .where("status", "==", "active")
      .get();

    const activitiesSnap = await db
      .collection("activities")
      .where("createdAt", ">=", Timestamp.fromDate(weekStart))
      .get();
    const allActivities = activitiesSnap.docs.map((d) => d.data() as ActivityRow);

    const leadsSnap = await db.collection("leads").where("status", "==", "won").get();

    const wonLeads = leadsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as LeadRow) }))
      .filter((l) => {
        const updated = l.updatedAt?.toDate?.();
        if (!updated) return false;
        return updated >= weekStart;
      });

    const teamStats = teamSnap.docs
      .map((doc) => {
        const member = doc.data() as { name?: string; role?: string };
        const memberActivities = allActivities.filter((a) => a.createdBy === doc.id);
        const memberWon = wonLeads.filter((l) => l.assignedToUid === doc.id);

        return {
          name: member.name || "",
          role: member.role || "",
          contactsMade: memberActivities.filter(
            (a) => a.type === "Call" || a.type === "Contact Made"
          ).length,
          siteVisits: memberActivities.filter(
            (a) => a.type === "Site Visit" || a.type === "Meeting"
          ).length,
          followUps: memberActivities.filter((a) => a.type === "Follow Up").length,
          dealsWon: memberWon.length,
          wonValue: memberWon.reduce((sum, l) => sum + Number(l.value ?? 0), 0),
          activitiesTotal: memberActivities.length,
        };
      })
      .sort((a, b) => b.dealsWon - a.dealsWon);

    const topPerformer = teamStats[0]?.dealsWon > 0 ? teamStats[0].name : "";
    const totalDealsWon = wonLeads.length;
    const totalWonValue = wonLeads.reduce((sum, l) => sum + Number(l.value ?? 0), 0);
    const totalActivities = allActivities.length;

    const weekStartStr = weekStart.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
    const weekEndStr = weekEnd.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const html = buildWeeklyReportHtml({
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      teamStats,
      totalDealsWon,
      totalWonValue,
      totalActivities,
      topPerformer,
    });

    const managers = teamSnap.docs.filter((d) => {
      const role = (d.data() as { role?: string }).role;
      return role === "admin" || role === "manager";
    });

    const results: Array<{ email: string; success: boolean; id?: string; error?: string }> = [];
    for (const manager of managers) {
      const email = (manager.data() as { email?: string }).email;
      if (!email) continue;
      const result = await sendEmail({
        to: email,
        subject: `Weekly Report ${weekStartStr}-${weekEndStr} — Bayan CRM`,
        html,
      });
      results.push({ email, ...result });
    }

    return NextResponse.json({ sent: results.length, results });
  } catch (err: unknown) {
    console.error("Weekly report error:", err);
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
