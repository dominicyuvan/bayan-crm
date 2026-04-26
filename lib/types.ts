import type { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "manager" | "agent";

// Firestore "read" document types always have an `id` (the document id).
// Keeping the base interfaces `id?` allows Firestore write payloads to omit `id`,
// while components that read documents can use `WithId<T>` for stricter typing.
export type WithId<T> = T & { id: string };
export type ContactDoc = WithId<Contact>;
export type LeadDoc = WithId<Lead>;
export type ActivityDoc = WithId<Activity>;
export type TaskDoc = WithId<Task>;
export type ContractDoc = WithId<Contract>;
export type TeamMemberDoc = WithId<TeamMember>;
export type CadenceTemplateDoc = WithId<CadenceTemplate>;

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  firstName: string;
  initials: string;
  role: UserRole;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

export interface Contact {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  alternatePhone?: string;
  whatsapp?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  assignedRepId?: string;
  // Owner (who created the record)
  assignedTo?: string;
  assignedToUid?: string;
  tags?: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactAt?: Timestamp;
}

// Real estate workflow stages (legacy + current values)
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "initial_contact"
  | "arrange_visit"
  | "proposal_sent"
  | "negotiation"
  | "won"
  | "lost"
  | "on_hold";
export type LeadTemperature = "cold" | "warm" | "hot";

export interface Lead {
  id?: string;
  contactId: string;
  contactName?: string;
  contactPhone?: string;
  company?: string;
  propertyType?: string;
  location?: string;
  value?: number | null;
  valueOmr?: number | null;
  status: LeadStatus;
  temperature?: LeadTemperature;
  score?: number;
  source?: string;
  assignedRepId?: string;
  // Owner (who created the record)
  assignedTo?: string;
  assignedToUid?: string;
  cadenceId?: string;
  cadenceStepIndex?: number | null;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactAt?: Timestamp;
  lastContactedAt?: Timestamp;
  closedAt?: Timestamp | null;
  wonAt?: Timestamp;
  lostAt?: Timestamp;
  generatedAt?: Timestamp;
  budgetMin?: number;
  budgetMax?: number;
  unitSize?: string;
  createdBy?: string;
  createdByName?: string;
}

export type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "site_visit"
  | "note"
  | "Follow Up"
  | "Call"
  | "Note"
  | "Site Visit"
  | "Meeting";

export interface Activity {
  id?: string;
  type: ActivityType;
  title?: string;
  notes?: string;
  contactId?: string | null;
  contactName?: string | null;
  leadId?: string | null;
  outcome?: string | null;
  createdBy?: string;
  createdByName?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  dueAt?: Timestamp | null;
  status?: string;

  // Legacy fields (kept for backward compatibility with older docs)
  repId?: string;
  occurredAt?: Timestamp;
}

export type TaskStatus = "pending" | "completed";
export type TaskType =
  | "follow_up"
  | "Follow Up"
  | "call"
  | "meeting"
  | "site_visit"
  | "admin"
  | "Call"
  | "Note"
  | "Site Visit"
  | "Meeting";

export interface Task {
  id?: string;
  type: TaskType;
  title: string;
  notes?: string;
  contactId?: string | null;
  contactName?: string | null;
  leadId?: string | null;
  assignedToId: string;
  assignedTo?: string;
  assignedToUid?: string;
  createdBy?: string;
  createdByName?: string;
  dueAt: Timestamp;
  status: TaskStatus;
  completedAt?: Timestamp | null;
  outcome?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Contract {
  id?: string;
  leadId: string;
  contactId: string;
  valueOmr: number;
  status: "draft" | "sent" | "signed" | "cancelled";
  signedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeamMember {
  id?: string;
  uid?: string;
  displayName?: string;
  initials?: string;

  name: string;
  email: string;
  role: "admin" | "manager" | "sales_executive" | "agent";
  phone: string;
  status: "active" | "inactive";
  joinedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;

  isActive?: boolean;
}

export interface CadenceStep {
  id?: string;
  dayOffset: number;
  type: ActivityType | "task";
  title: string;
  notes?: string;
}

export interface CadenceTemplate {
  id?: string;
  name: string;
  description?: string;
  durationDays: number;
  steps: CadenceStep[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

