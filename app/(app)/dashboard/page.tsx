"use client";

import * as React from "react";
import { startOfDay, startOfMonth } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useActivities, useContacts, useLeads, useTasks } from "@/lib/firestore-provider";
import { tsToDate } from "@/lib/firestore";
import { formatOMR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

function KpiCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const leads = useLeads();
  const activities = useActivities();
  const tasks = useTasks();

  const role = profile?.role ?? "agent";
  const isAgent = role === "agent";

  const loading = contacts.loading || leads.loading || activities.loading || tasks.loading;

  const todayStart = React.useMemo(() => startOfDay(new Date()), []);
  const monthStart = React.useMemo(() => startOfMonth(new Date()), []);

  const myLeads = React.useMemo(() => {
    if (!profile?.uid) return [];
    return leads.items.filter((l) => l.assignedRepId === profile.uid && l.status !== "Won" && l.status !== "Lost");
  }, [leads.items, profile?.uid]);

  const overdue = React.useMemo(
    () =>
      tasks.items.filter(
        (t) => t.isOverdue && (!isAgent || t.assignedToId === profile?.uid)
      ),
    [tasks.items, isAgent, profile?.uid]
  );

  const kpis = React.useMemo(() => {
    const visibleTasks = tasks.items.filter(
      (t) => !isAgent || t.assignedToId === profile?.uid
    );
    const visibleLeads = leads.items.filter(
      (l) => !isAgent || l.assignedRepId === profile?.uid
    );
    const visibleActivities = activities.items.filter(
      (a) => !isAgent || a.repId === profile?.uid
    );

    const contactsMadeToday = visibleActivities.filter((a) => {
      const d = tsToDate(a.occurredAt);
      return !!d && d >= todayStart;
    }).length;

    const siteVisitsToday = visibleActivities.filter((a) => {
      const d = tsToDate(a.occurredAt);
      return a.type === "site_visit" && !!d && d >= todayStart;
    }).length;

    const followUpsToday = visibleTasks.filter((t) => {
      const d = tsToDate(t.dueAt);
      return t.status !== "completed" && !!d && d >= todayStart;
    }).length;

    const dealsWonThisMonth = visibleLeads.filter((l) => {
      const d = tsToDate(l.wonAt);
      return l.status === "Won" && !!d && d >= monthStart;
    }).length;

    const pipelineValue = visibleLeads.reduce((sum, l) => {
      return sum + (l.status !== "Lost" && l.status !== "Won" ? (l.valueOmr ?? 0) : 0);
    }, 0);

    return {
      contactsMadeToday,
      siteVisitsToday,
      followUpsToday,
      dealsWonThisMonth,
      pipelineValue,
    };
  }, [activities.items, leads.items, tasks.items, todayStart, monthStart, isAgent, profile?.uid]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold tracking-tight">
          Dashboard
        </div>
        <div className="text-sm text-muted-foreground">
          Today’s KPIs, your pipeline, and what needs attention.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Contacts Made today" value={kpis.contactsMadeToday} />
        <KpiCard label="Site Visits today" value={kpis.siteVisitsToday} />
        <KpiCard label="Follow Ups today" value={kpis.followUpsToday} />
        <KpiCard label="Deals Won this month" value={kpis.dealsWonThisMonth} />
        <KpiCard label="Pipeline value" value={formatOMR(kpis.pipelineValue)} />
      </div>

      {overdue.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <div className="text-sm font-medium">Overdue tasks</div>
          <div className="mt-1 text-sm text-muted-foreground">
            You have <span className="font-semibold">{overdue.length}</span> overdue task(s).
          </div>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <div className="text-sm font-medium">Recent activities</div>
          <div className="mt-3 space-y-2">
            {activities.items.slice(0, 6).map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {tsToDate(a.occurredAt)?.toLocaleString() ?? ""}
                  </div>
                </div>
                {a.notes && <div className="mt-1 text-sm text-muted-foreground">{a.notes}</div>}
              </div>
            ))}
            {activities.items.length === 0 && (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-medium">My open leads</div>
          <div className="mt-3 space-y-2">
            {myLeads.slice(0, 6).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {l.propertyType ?? "Lead"} {l.location ? `• ${l.location}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                  </div>
                </div>
                <Badge variant="secondary">{l.status}</Badge>
              </div>
            ))}
            {myLeads.length === 0 && (
              <div className="text-sm text-muted-foreground">No open leads assigned to you.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

