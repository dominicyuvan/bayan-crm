import { tsToDate } from "@/lib/firestore";
import type { Activity, Lead } from "./types";

export interface FollowUpItem {
  leadId: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  company: string;
  propertyType: string;
  daysSinceContact: number | null;
  urgency: "overdue" | "today" | "soon";
  reason: string;
  leadStatus: string;
  leadValue: number;
}

function isWonOrLost(status: string) {
  const normalized = status.toLowerCase();
  return normalized === "won" || normalized === "lost";
}

export function buildFollowUpQueue(
  leads: Lead[],
  activities: Activity[],
  userId: string,
  userRole: string
): FollowUpItem[] {
  const now = new Date();
  const items: FollowUpItem[] = [];

  const relevantLeads = leads.filter((l) => {
    if (isWonOrLost(l.status)) return false;
    if (userRole === "agent" && (l.assignedToUid ?? "") !== userId) return false;
    return true;
  });

  for (const lead of relevantLeads) {
    if (!lead.id || !lead.contactId) continue;

    const leadAny = lead as unknown as {
      lastContactedAt?: Lead["lastContactAt"];
      contactName?: string;
      contactPhone?: string;
      company?: string;
      value?: number;
    };

    const lastContact =
      tsToDate(leadAny.lastContactedAt) ??
      tsToDate(lead.lastContactAt) ??
      null;

    const daysSince = lastContact
      ? Math.floor((now.getTime() - lastContact.getTime()) / 86400000)
      : null;

    const leadActivities = activities.filter((a) => a.leadId === lead.id);
    const latestActivity = leadActivities
      .map((a) => tsToDate(a.createdAt))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const effectiveDaysSince = latestActivity
      ? Math.floor((now.getTime() - latestActivity.getTime()) / 86400000)
      : daysSince;

    // Never contacted
    if (!lastContact && !latestActivity) {
      items.push({
        leadId: lead.id,
        contactId: lead.contactId,
        contactName: leadAny.contactName || "Unknown contact",
        contactPhone: leadAny.contactPhone || "",
        company: leadAny.company || "",
        propertyType: lead.propertyType || "Lead",
        daysSinceContact: null,
        urgency: "overdue",
        reason: "Never contacted",
        leadStatus: lead.status,
        leadValue: leadAny.value ?? lead.valueOmr ?? 0,
      });
      continue;
    }

    // Overdue: > 14 days
    if (effectiveDaysSince && effectiveDaysSince > 14) {
      items.push({
        leadId: lead.id,
        contactId: lead.contactId,
        contactName: leadAny.contactName || "Unknown contact",
        contactPhone: leadAny.contactPhone || "",
        company: leadAny.company || "",
        propertyType: lead.propertyType || "Lead",
        daysSinceContact: effectiveDaysSince,
        urgency: effectiveDaysSince > 21 ? "overdue" : "today",
        reason: `${effectiveDaysSince} days since last contact`,
        leadStatus: lead.status,
        leadValue: leadAny.value ?? lead.valueOmr ?? 0,
      });
      continue;
    }

    // Due soon: 7-14 days
    if (effectiveDaysSince && effectiveDaysSince >= 7) {
      items.push({
        leadId: lead.id,
        contactId: lead.contactId,
        contactName: leadAny.contactName || "Unknown contact",
        contactPhone: leadAny.contactPhone || "",
        company: leadAny.company || "",
        propertyType: lead.propertyType || "Lead",
        daysSinceContact: effectiveDaysSince,
        urgency: "soon",
        reason: `${effectiveDaysSince} days since last contact`,
        leadStatus: lead.status,
        leadValue: leadAny.value ?? lead.valueOmr ?? 0,
      });
    }
  }

  // Sort: overdue first, then today, then soon; within group by longest first.
  return items.sort((a, b) => {
    const urgencyOrder = { overdue: 0, today: 1, soon: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    const aDays = a.daysSinceContact ?? 999;
    const bDays = b.daysSinceContact ?? 999;
    return bDays - aDays;
  });
}
