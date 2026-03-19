import type { CadenceTemplate } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

// Static defaults used client-side; actual stored cadences (if any)
// will come from Firestore via useFirestore().

const now = Timestamp.now();

export const DEFAULT_CADENCES: CadenceTemplate[] = [
  {
    id: "office_lead_21_day",
    name: "Office Lead • 21 day",
    description: "Structured 3-week follow-up for inbound office leads.",
    durationDays: 21,
    steps: [
      { id: "1", dayOffset: 0, type: "call", title: "Initial response" },
      { id: "2", dayOffset: 1, type: "whatsapp", title: "WhatsApp follow-up" },
      { id: "3", dayOffset: 3, type: "email", title: "Send brochure / details" },
      { id: "4", dayOffset: 7, type: "site_visit", title: "Schedule site visit" },
      { id: "5", dayOffset: 14, type: "call", title: "Decision follow-up" },
      { id: "6", dayOffset: 21, type: "task", title: "Close out or recycle" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "cold_outreach_30_day",
    name: "Cold Outreach • 30 day",
    description: "Light-touch outreach for cold prospects over one month.",
    durationDays: 30,
    steps: [
      { id: "1", dayOffset: 0, type: "email", title: "Intro email" },
      { id: "2", dayOffset: 3, type: "call", title: "Intro call" },
      { id: "3", dayOffset: 7, type: "whatsapp", title: "WhatsApp follow-up" },
      { id: "4", dayOffset: 14, type: "email", title: "Case study / social proof" },
      { id: "5", dayOffset: 21, type: "call", title: "Decision check-in" },
      { id: "6", dayOffset: 30, type: "task", title: "Mark won/lost or recycle" },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "warm_referral_14_day",
    name: "Warm Referral • 14 day",
    description: "Fast-track cadence for warm referrals.",
    durationDays: 14,
    steps: [
      { id: "1", dayOffset: 0, type: "call", title: "Intro call" },
      { id: "2", dayOffset: 1, type: "email", title: "Follow-up email" },
      { id: "3", dayOffset: 3, type: "meeting", title: "Schedule meeting" },
      { id: "4", dayOffset: 7, type: "call", title: "Objection handling" },
      { id: "5", dayOffset: 14, type: "task", title: "Close or escalate" },
    ],
    createdAt: now,
    updatedAt: now,
  },
];

