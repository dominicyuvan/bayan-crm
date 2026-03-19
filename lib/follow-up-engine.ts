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
    // Skip closed leads
    if (isWonOrLost(l.status)) return false;
    // Agents only see their own leads
    if (userRole === "agent" && (l.assignedToUid ?? "") !== userId) return false;
    return true;
  });

  for (const lead of relevantLeads) {
    const lastContact = tsToDate(lead.lastContactedAt) ?? null;
    const daysSince = lastContact
      ? Math.floor((now.getTime() - lastContact.getTime()) / 86400000)
      : null;

    // Never contacted — always show
    if (!lastContact) {
      items.push({
        leadId: lead.id || "",
        contactId: lead.contactId || "",
        contactName: lead.contactName || "Unknown",
        contactPhone: lead.contactPhone || "",
        company: lead.company || "",
        propertyType: lead.propertyType || "",
        daysSinceContact: null,
        urgency: "overdue" as const,
        reason: "Never contacted",
        leadStatus: lead.status,
        leadValue: lead.value || 0,
      });
      continue;
    }

    // Overdue: > 14 days
    if (daysSince && daysSince > 14) {
      items.push({
        leadId: lead.id || "",
        contactId: lead.contactId || "",
        contactName: lead.contactName || "Unknown",
        contactPhone: lead.contactPhone || "",
        company: lead.company || "",
        propertyType: lead.propertyType || "",
        daysSinceContact: daysSince,
        urgency: "overdue" as const,
        reason: `${daysSince} days no contact`,
        leadStatus: lead.status,
        leadValue: lead.value || 0,
      });
      continue;
    }

    // 7-14 days — due today
    if (daysSince && daysSince >= 7) {
      items.push({
        leadId: lead.id || "",
        contactId: lead.contactId || "",
        contactName: lead.contactName || "Unknown",
        contactPhone: lead.contactPhone || "",
        company: lead.company || "",
        propertyType: lead.propertyType || "",
        daysSinceContact: daysSince,
        urgency: "today" as const,
        reason: `${daysSince} days no contact`,
        leadStatus: lead.status,
        leadValue: lead.value || 0,
      });
    }
  }

  // Sort: overdue first, then today, then soon
  // Within each group: sort by daysSinceContact descending (longest first)
  return items.sort((a, b) => {
    const order = { overdue: 0, today: 1, soon: 2 };
    if (order[a.urgency] !== order[b.urgency]) {
      return order[a.urgency] - order[b.urgency];
    }
    const aDays = a.daysSinceContact ?? 999;
    const bDays = b.daysSinceContact ?? 999;
    return bDays - aDays;
  });
}
