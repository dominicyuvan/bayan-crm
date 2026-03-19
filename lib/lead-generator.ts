import { tsToDate } from "@/lib/firestore";
import type { Activity, Contact, Lead } from "./types";

export interface ScoredContact {
  contact: Contact;
  coldnessScore: number;
  reasons: string[];
  daysSinceContact: number | null;
  hasActiveLead: boolean;
  hasLostLead: boolean;
}

function isWonStatus(status: string) {
  return status === "Won" || status === "won";
}

function isLostStatus(status: string) {
  return status === "Lost" || status === "lost";
}

export function scoreContactColdness(
  contact: Contact,
  leads: Lead[],
  activities: Activity[]
): ScoredContact {
  let score = 0;
  const reasons: string[] = [];

  // Get contact's leads
  const contactLeads = leads.filter((l) => l.contactId === contact.id);
  const activeLeads = contactLeads.filter(
    (l) => !isWonStatus(l.status) && !isLostStatus(l.status)
  );
  const lostLeads = contactLeads.filter((l) => isLostStatus(l.status));
  const hasActiveLead = activeLeads.length > 0;
  const hasLostLead = lostLeads.length > 0;

  // Skip contacts that already have active leads
  if (hasActiveLead) {
    return {
      contact,
      coldnessScore: 0,
      reasons: ["Has active lead"],
      daysSinceContact: null,
      hasActiveLead,
      hasLostLead,
    };
  }

  // Never been contacted
  const lastContact =
    tsToDate((contact as unknown as { lastContactedAt?: Contact["lastContactAt"] }).lastContactedAt) ??
    tsToDate(contact.lastContactAt) ??
    null;
  const daysSinceContact = lastContact
    ? Math.floor((Date.now() - lastContact.getTime()) / 86400000)
    : null;

  if (!lastContact) {
    score += 50;
    reasons.push("Never contacted");
  } else if (daysSinceContact && daysSinceContact > 60) {
    score += 40;
    reasons.push(`${daysSinceContact} days since last contact`);
  } else if (daysSinceContact && daysSinceContact > 30) {
    score += 30;
    reasons.push(`${daysSinceContact} days since last contact`);
  } else if (daysSinceContact && daysSinceContact > 14) {
    score += 20;
    reasons.push(`${daysSinceContact} days since last contact`);
  } else if (daysSinceContact && daysSinceContact > 7) {
    score += 10;
    reasons.push(`${daysSinceContact} days since last contact`);
  }

  // No lead history at all — fresh prospect
  if (contactLeads.length === 0) {
    score += 25;
    reasons.push("No lead history");
  }

  // Has a lost lead — worth re-engaging
  if (hasLostLead) {
    score += 15;
    reasons.push("Previously lost — worth re-engaging");
  }

  // High intent sources
  if (contact.source === "Referral") {
    score += 10;
    reasons.push("Referral — high intent");
  }
  if (contact.source === "Exhibition") {
    score += 8;
    reasons.push("Exhibition lead");
  }

  // Has phone number (can actually be contacted)
  if (!contact.phone) {
    score -= 20;
    reasons.push("No phone number");
  }

  // Has WhatsApp (easier to reach)
  if (contact.whatsapp) {
    score += 5;
  }

  // Get activity count for this contact
  const contactActivities = activities.filter((a) => a.contactId === contact.id);
  if (contactActivities.length === 0 && lastContact) {
    score += 10;
    reasons.push("No logged activities");
  }

  return {
    contact,
    coldnessScore: Math.max(0, Math.min(100, score)),
    reasons,
    daysSinceContact,
    hasActiveLead,
    hasLostLead,
  };
}

export function generateTopLeads(
  contacts: Contact[],
  leads: Lead[],
  activities: Activity[],
  count = 5
): ScoredContact[] {
  const scored = contacts
    .map((c) => scoreContactColdness(c, leads, activities))
    .filter((s) => !s.hasActiveLead && s.coldnessScore > 0 && s.contact.phone)
    .sort((a, b) => b.coldnessScore - a.coldnessScore);

  return scored.slice(0, count);
}
