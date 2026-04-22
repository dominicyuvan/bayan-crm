"use client";

import * as React from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { isBefore } from "date-fns";
import type {
  Activity,
  Contact,
  Contract,
  Lead,
  Task,
  TeamMember,
  WithId,
} from "@/lib/types";
import {
  activitiesCol,
  contactsCol,
  contractsCol,
  leadsCol,
  tasksCol,
  teamMembersCol,
  tsToDate,
} from "@/lib/firestore";

type TaskComputed = WithId<Task> & { isOverdue: boolean };

type CollectionState<T> = {
  items: Array<WithId<T>>;
  loading: boolean;
  error: string | null;
};

function useCollection<T>(q: ReturnType<typeof query>) {
  const [state, setState] = React.useState<CollectionState<T>>({
    items: [],
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setState((s) => ({ ...s, loading: false }));
    }, 5000);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
        if (!settled) settled = true;
        clearTimeout(timeout);
        setState({ items, loading: false, error: null });
      },
      (err) => {
        if (!settled) settled = true;
        clearTimeout(timeout);
        setState((s) => ({
          ...s,
          loading: false,
          error: err.message ?? "Failed to load data",
        }));
      }
    );
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [q]);

  return state;
}

type FirestoreContextValue = {
  contacts: CollectionState<Contact>;
  leads: CollectionState<Lead>;
  activities: CollectionState<Activity>;
  tasks: { items: TaskComputed[]; loading: boolean; error: string | null };
  contracts: CollectionState<Contract>;
  teamMembers: CollectionState<TeamMember>;
};

const FirestoreContext = React.createContext<FirestoreContextValue | null>(null);
const ContactsContext = React.createContext<CollectionState<Contact> | null>(
  null
);
const LeadsContext = React.createContext<CollectionState<Lead> | null>(null);
const ActivitiesContext =
  React.createContext<CollectionState<Activity> | null>(null);
const TasksContext = React.createContext<{
  items: TaskComputed[];
  loading: boolean;
  error: string | null;
} | null>(null);
const ContractsContext =
  React.createContext<CollectionState<Contract> | null>(null);
const TeamMembersContext =
  React.createContext<CollectionState<TeamMember> | null>(null);

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  // Memoize queries to prevent re-subscribing every render.
  const contactsQ = React.useMemo(
    () => query(contactsCol, orderBy("updatedAt", "desc")),
    []
  );
  const leadsQ = React.useMemo(
    () => query(leadsCol, orderBy("updatedAt", "desc")),
    []
  );
  const activitiesQ = React.useMemo(
    () => query(activitiesCol, orderBy("createdAt", "desc")),
    []
  );
  const tasksQ = React.useMemo(() => query(tasksCol, orderBy("dueAt", "asc")), []);
  const contractsQ = React.useMemo(
    () => query(contractsCol, orderBy("updatedAt", "desc")),
    []
  );
  const teamMembersQ = React.useMemo(
    () => query(teamMembersCol, orderBy("displayName", "asc")),
    []
  );
  const contacts = useCollection<Contact>(contactsQ);
  const rawLeads = useCollection<Lead>(leadsQ);
  const activities = useCollection<Activity>(activitiesQ);
  const rawTasks = useCollection<Task>(tasksQ);
  const contracts = useCollection<Contract>(contractsQ);
  const teamMembers = useCollection<TeamMember>(teamMembersQ);

  const leads = React.useMemo<CollectionState<Lead>>(() => {
    const items = rawLeads.items.filter((lead) => {
      const generatedAt = (lead as Lead & { generatedAt?: unknown }).generatedAt;
      const source = ((lead.source ?? "") as string).trim().toLowerCase();
      return !generatedAt && source !== "generated";
    });
    return { items, loading: rawLeads.loading, error: rawLeads.error };
  }, [rawLeads.items, rawLeads.loading, rawLeads.error]);

  const tasks = React.useMemo(() => {
    const now = new Date();
    const computed: TaskComputed[] = rawTasks.items.map((t) => {
      const due = tsToDate((t as Task).dueAt) ?? null;
      const isOverdue =
        t.status !== "completed" && !!due && isBefore(due, now);
      return { ...(t as WithId<Task>), isOverdue };
    });
    return { items: computed, loading: rawTasks.loading, error: rawTasks.error };
  }, [rawTasks.items, rawTasks.loading, rawTasks.error]);

  const value: FirestoreContextValue = React.useMemo(
    () => ({
      contacts,
      leads,
      activities,
      tasks,
      contracts,
      teamMembers,
    }),
    [contacts, leads, activities, tasks, contracts, teamMembers]
  );

  return (
    <FirestoreContext.Provider value={value}>
      <ContactsContext.Provider value={contacts}>
        <LeadsContext.Provider value={leads}>
          <ActivitiesContext.Provider value={activities}>
            <TasksContext.Provider value={tasks}>
              <ContractsContext.Provider value={contracts}>
                <TeamMembersContext.Provider value={teamMembers}>
                  {children}
                </TeamMembersContext.Provider>
              </ContractsContext.Provider>
            </TasksContext.Provider>
          </ActivitiesContext.Provider>
        </LeadsContext.Provider>
      </ContactsContext.Provider>
    </FirestoreContext.Provider>
  );
}

export function useFirestore() {
  const ctx = React.useContext(FirestoreContext);
  if (!ctx) throw new Error("useFirestore must be used within FirestoreProvider");
  return ctx;
}

export function useContacts() {
  const ctx = React.useContext(ContactsContext);
  if (!ctx) throw new Error("useContacts must be used within FirestoreProvider");
  return ctx;
}

export function useLeads() {
  const ctx = React.useContext(LeadsContext);
  if (!ctx) throw new Error("useLeads must be used within FirestoreProvider");
  return ctx;
}

export function useActivities() {
  const ctx = React.useContext(ActivitiesContext);
  if (!ctx)
    throw new Error("useActivities must be used within FirestoreProvider");
  return ctx;
}

export function useTasks() {
  const ctx = React.useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within FirestoreProvider");
  return ctx;
}

export function useContracts() {
  const ctx = React.useContext(ContractsContext);
  if (!ctx)
    throw new Error("useContracts must be used within FirestoreProvider");
  return ctx;
}

export function useTeamMembers() {
  const ctx = React.useContext(TeamMembersContext);
  if (!ctx)
    throw new Error("useTeamMembers must be used within FirestoreProvider");
  return ctx;
}

