import type { Timestamp } from "firebase/firestore";

export type UserRole = "manager" | "agent";

export interface UserProfile {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
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
  tags?: string[];
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactAt?: Timestamp;
}

export type LeadStatus = "New" | "Contacted" | "Qualified" | "Won" | "Lost";
export type LeadTemperature = "cold" | "warm" | "hot";

export interface Lead {
  id?: string;
  contactId: string;
  propertyType?: string;
  location?: string;
  valueOmr?: number;
  status: LeadStatus;
  temperature?: LeadTemperature;
  score?: number;
  source?: string;
  assignedRepId?: string;
  cadenceId?: string;
  cadenceStepIndex?: number;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactAt?: Timestamp;
  wonAt?: Timestamp;
  lostAt?: Timestamp;
}

export type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "site_visit"
  | "note";

export interface Activity {
  id?: string;
  type: ActivityType;
  title: string;
  notes?: string;
  contactId?: string;
  leadId?: string;
  repId: string;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

export type TaskStatus = "pending" | "completed";
export type TaskType = "follow_up" | "call" | "meeting" | "site_visit" | "admin";

export interface Task {
  id?: string;
  type: TaskType;
  title: string;
  notes?: string;
  contactId?: string;
  leadId?: string;
  assignedToId: string;
  dueAt: Timestamp;
  status: TaskStatus;
  completedAt?: Timestamp;
  outcome?: string;
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
  uid: string;
  email: string;
  displayName: string;
  initials: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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

