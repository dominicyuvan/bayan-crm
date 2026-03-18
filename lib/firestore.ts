import type { Timestamp } from "firebase/firestore";
import {
  collection,
  type CollectionReference,
  type Firestore,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Activity,
  CadenceTemplate,
  Contact,
  Contract,
  Lead,
  Task,
  TeamMember,
} from "@/lib/types";

export const firestore: Firestore = db;

function typedCollection<T>(path: string) {
  return collection(firestore, path) as CollectionReference<T>;
}

export const contactsCol = typedCollection<Contact>("contacts");
export const leadsCol = typedCollection<Lead>("leads");
export const activitiesCol = typedCollection<Activity>("activities");
export const tasksCol = typedCollection<Task>("tasks");
export const contractsCol = typedCollection<Contract>("contracts");
export const cadencesCol = typedCollection<CadenceTemplate>("cadences");
export const teamMembersCol = typedCollection<TeamMember>("team_members");

export function tsToDate(ts?: Timestamp | null) {
  if (!ts) return null;
  return ts.toDate();
}

export function tsToMillis(ts?: Timestamp | null) {
  if (!ts) return null;
  return ts.toMillis();
}

