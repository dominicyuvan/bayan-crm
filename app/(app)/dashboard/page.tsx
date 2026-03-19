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
import {
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";

function KpiCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

function truncateText(text: string, max = 60) {
  const t = (text ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function relativeTime(from: Date) {
  const now = new Date();
  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  const startFrom = new Date(from);
  startFrom.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (startNow.getTime() - startFrom.getTime()) / 86400000
  );

  if (diffDays === 0) {
    const diffMs = now.getTime() - from.getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return from.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getActivityVisual(type: string) {
  switch (type) {
    case "call":
    case "Call":
    case "Contact Made":
      return { Icon: Phone, iconBg: "bg-blue-100", iconColor: "text-blue-600" };
    case "site_visit":
    case "site visit":
    case "Site Visit":
      return { Icon: MapPin, iconBg: "bg-green-100", iconColor: "text-green-600" };
    case "meeting":
    case "Meeting":
    case "meeting ": // defensive
      return { Icon: Users, iconBg: "bg-green-100", iconColor: "text-green-600" };
    case "note":
    case "Note":
    case "Follow Up":
    case "follow_up":
    case "whatsapp":
      return {
        Icon: MessageSquare,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
      };
    case "email":
    case "Email":
      return { Icon: Mail, iconBg: "bg-purple-100", iconColor: "text-purple-600" };
    default:
      return {
        Icon: FileText,
        iconBg: "bg-gray-100",
        iconColor: "text-gray-600",
      };
  }
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

  const contactById = React.useMemo(() => {
    const map = new Map<string, (typeof contacts.items)[number]>();
    for (const c of contacts.items) {
      if (c.id) map.set(c.id, c);
    }
    return map;
  }, [contacts.items]);

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
    const visibleLeads = leads.items.filter(
      (l) => !isAgent || l.assignedRepId === profile?.uid
    );
    const todayActivities = activities.items.filter((a) => {
      if (!profile?.uid) return false;
      const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.repId;
      if (isAgent && createdBy !== profile.uid) return false;
      const d = tsToDate(a.createdAt);
      return !!d && d >= todayStart;
    });

    const contactsMadeToday = todayActivities.filter((a) => {
      const t = a.type as string;
      return t === "call" || t === "Call" || t === "Contact Made";
    }).length;
    const siteVisits = todayActivities.filter(
      (a) => {
        const t = a.type as string;
        return (
          t === "site_visit" || t === "meeting" || t === "Site Visit" || t === "Meeting"
        );
      }
    ).length;
    const followUpsToday = todayActivities.filter(
      (a) => {
        const t = a.type as string;
        return (
          t === "email" ||
          t === "note" ||
          t === "whatsapp" ||
          t === "Email" ||
          t === "Follow Up" ||
          t === "follow_up"
        );
      }
    ).length;

    const dealsWonThisMonth = visibleLeads.filter((l) => {
      const d = tsToDate(l.wonAt);
      return l.status === "Won" && !!d && d >= monthStart;
    }).length;

    const pipelineValue = visibleLeads.reduce((sum, l) => {
      return sum + (l.status !== "Lost" && l.status !== "Won" ? (l.valueOmr ?? 0) : 0);
    }, 0);

    return {
      contactsMadeToday,
      siteVisitsToday: siteVisits,
      followUpsToday,
      dealsWonThisMonth,
      pipelineValue,
      todayActivities,
    };
  }, [activities.items, leads.items, tasks.items, todayStart, monthStart, isAgent, profile?.uid]);

  const personalTodayActivities = React.useMemo(() => {
    if (!profile?.uid) return [];
    return activities.items.filter((a) => {
      const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.repId;
      if (createdBy !== profile.uid) return false;
      const d = tsToDate(a.createdAt);
      return !!d && d >= todayStart;
    });
  }, [activities.items, profile?.uid, todayStart]);

  const recentActivities = React.useMemo(() => {
    if (!profile?.uid) return [];
    const sorted = [...activities.items]
      .filter((a) => {
        const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.repId;
        return createdBy === profile.uid;
      })
      .sort((a, b) => {
      const ad = tsToDate(a.createdAt)?.getTime() ?? 0;
      const bd = tsToDate(b.createdAt)?.getTime() ?? 0;
      return bd - ad;
      });

    return sorted.slice(0, 10);
  }, [activities.items, profile?.uid]);

  const todaySummary = React.useMemo(() => {
    const todayActivities = personalTodayActivities;
    const calls = todayActivities.filter((a) => {
      const t = a.type as string;
      return t === "call" || t === "Call" || t === "Contact Made";
    }).length;
    const siteVisits = todayActivities.filter(
      (a) => {
        const t = a.type as string;
        return t === "site_visit" || t === "meeting" || t === "Site Visit" || t === "Meeting";
      }
    ).length;
    const followUps = todayActivities.filter(
      (a) => {
        const t = a.type as string;
        return (
          t === "email" ||
          t === "note" ||
          t === "whatsapp" ||
          t === "Email" ||
          t === "Follow Up" ||
          t === "follow_up"
        );
      }
    ).length;

    if (todayActivities.length === 0) {
      return "No activities logged yet today — get started! 💪";
    }

    const siteLabel = siteVisits === 1 ? "site visit" : "site visits";
    const followLabel = followUps === 1 ? "follow up" : "follow ups";
    const callLabel = calls === 1 ? "call" : "calls";
    return `Today: ${calls} ${callLabel} · ${siteVisits} ${siteLabel} · ${followUps} ${followLabel}`;
  }, [personalTodayActivities]);

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
        <div className="mt-2 text-sm text-muted-foreground">{todaySummary}</div>
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
          <div className="text-sm font-medium">Recent Activity</div>
          <div className="mt-3">
            {recentActivities.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent activities.</div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((activity) => {
                  const createdAt = tsToDate(activity.createdAt);
                  const createdAtDate = createdAt ?? tsToDate(activity.occurredAt) ?? new Date();
                  const { Icon, iconBg, iconColor } = getActivityVisual(activity.type);

                  const contact = activity.contactId
                    ? contactById.get(activity.contactId)
                    : undefined;
                  const directContactName = (activity as unknown as { contactName?: string })
                    .contactName;
                  const contactName = directContactName
                    ? directContactName
                    : contact
                    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
                    : "";

                  const notes = (activity.notes ?? activity.title ?? "").toString();
                  const outcome = ((activity as unknown as { outcome?: string }).outcome ?? "neutral") as
                    | "positive"
                    | "negative"
                    | "neutral"
                    | string;

                  const outcomeColor =
                    outcome === "positive"
                      ? "bg-green-500"
                      : outcome === "negative"
                      ? "bg-red-500"
                      : "bg-gray-400";

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50"
                    >
                      <div className={`p-2 rounded-lg ${iconBg}`}>
                        <Icon className={`h-4 w-4 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {contactName || activity.type}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {relativeTime(createdAtDate)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {truncateText(notes)}
                        </p>
                      </div>
                      {activity && (
                        <div
                          className={`h-2 w-2 rounded-full mt-2 ${outcomeColor}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
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

