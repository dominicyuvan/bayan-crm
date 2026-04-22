"use client";

import * as React from "react";
import { addDays, startOfDay } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useActivities, useContacts, useLeads, useTasks } from "@/lib/firestore-provider";
import { firestore, tsToDate } from "@/lib/firestore";
import { cn, fireConfetti, formatOMR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Check,
  Users,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { AddContactModal } from "@/components/contacts/add-contact-modal";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { ContactDetailDrawer } from "@/components/contacts/contact-detail-drawer";
import { useLogActivityControl } from "@/lib/log-activity-control-context";
import type { Activity, Lead, Task } from "@/lib/types";

function KpiCard({
  label,
  value,
  className,
  subtext,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  subtext?: string;
  icon?: React.ComponentType<{ className?: string }>;
  highlight?: "red" | "amber" | "green";
}) {
  return (
    <Card className={cn("border-t-[3px] border-t-primary p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{label}</div>
        {Icon ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {subtext ? (
        <div
          className={cn(
            "mt-1 text-xs",
            highlight === "red" && "text-red-600",
            highlight === "amber" && "text-amber-600",
            highlight === "green" && "text-green-600",
            !highlight && "text-muted-foreground"
          )}
        >
          {subtext}
        </div>
      ) : null}
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

function getActivityTypeBorderClass(type: string) {
  switch (type) {
    case "call":
    case "Call":
    case "Contact Made":
      return "border-l-4 border-l-blue-400";
    case "site_visit":
    case "site visit":
    case "Site Visit":
      return "border-l-4 border-l-green-400";
    case "meeting":
    case "Meeting":
      return "border-l-4 border-l-amber-400";
    case "note":
    case "Note":
      return "border-l-4 border-l-purple-400";
    default:
      return "border-l-4 border-l-border";
  }
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { setOpen: setLogActivityOpen } = useLogActivityControl();
  const contacts = useContacts();
  const leads = useLeads();
  const activities = useActivities();
  const tasks = useTasks();

  const loading = contacts.loading || leads.loading || activities.loading || tasks.loading;

  const todayStart = React.useMemo(() => startOfDay(new Date()), []);

  const contactById = React.useMemo(() => {
    const map = new Map<string, (typeof contacts.items)[number]>();
    for (const c of contacts.items) {
      if (c.id) map.set(c.id, c);
    }
    return map;
  }, [contacts.items]);

  const myLeads = React.useMemo(() => {
    if (!profile?.uid) return [];
    return leads.items.filter((l) => {
      const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
      return ownerUid === profile.uid && l.status !== "Won" && l.status !== "Lost";
    });
  }, [leads.items, profile?.uid]);

  const overdue = React.useMemo(
    () =>
      tasks.items.filter(
        (t) => t.isOverdue && t.assignedToId === profile?.uid
      ),
    [tasks.items, profile?.uid]
  );

  const userFirstName = profile?.firstName || profile?.displayName?.split(" ")[0] || "Bayan";

  const calculateStreak = React.useCallback(
    (items: Activity[], userId: string) => {
      if (!userId) return 0;
      let streak = 0;
      let checkDate = startOfDay(new Date());

      // Count consecutive days (including today) where the user logged >= 1 activity.
      while (true) {
        const hasActivity = items.some((a) => {
          const createdBy =
            ((a as unknown as { createdBy?: string }).createdBy ?? a.repId) as
              | string
              | undefined;
          if (!createdBy || createdBy !== userId) return false;
          const date = tsToDate(a.createdAt);
          if (!date) return false;
          const actDate = startOfDay(date);
          return actDate.getTime() === checkDate.getTime();
        });

        if (!hasActivity) break;
        streak += 1;
        checkDate = addDays(checkDate, -1);
      }

      return streak;
    },
    []
  );

  const kpis = React.useMemo(() => {
    const visibleLeads = leads.items.filter(
      (l) => {
        const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
        return ownerUid === profile?.uid;
      }
    );
    const todayActivities = activities.items.filter((a) => {
      if (!profile?.uid) return false;
      const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.repId;
      if (createdBy !== profile.uid) return false;
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
          t === "Note" ||
          t === "whatsapp" ||
          t === "Email" ||
          t === "Follow Up" ||
          t === "follow_up"
        );
      }
    ).length;

    const pipelineValue = visibleLeads.reduce((sum, l) => {
      return sum + (l.status !== "Lost" && l.status !== "Won" ? (l.valueOmr ?? 0) : 0);
    }, 0);

    return {
      contactsMadeToday,
      siteVisitsToday: siteVisits,
      followUpsToday,
      pipelineValue,
      todayActivities,
    };
  }, [activities.items, leads.items, tasks.items, todayStart, profile?.uid]);

  const dealsWon = React.useMemo(() => {
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    return leads.items.filter((l) => {
      if (l.status.toLowerCase() !== "won") return false;
      const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
      if (ownerUid !== profile?.uid) return false;
      const closedDate =
        tsToDate(l.closedAt) ??
        tsToDate((l as unknown as { closedAt?: typeof l.updatedAt }).closedAt) ??
        tsToDate(l.updatedAt) ??
        null;
      if (!closedDate) return true;
      return closedDate >= thisMonthStart;
    });
  }, [leads.items, profile]);

  const dealsWonCount = dealsWon.length;
  const dealsWonValue = dealsWon.reduce(
    (sum, l) => sum + (l.value ?? l.valueOmr ?? 0),
    0
  );
  const prevDealsWonCount = React.useRef(dealsWonCount);

  React.useEffect(() => {
    if (dealsWonCount > prevDealsWonCount.current && prevDealsWonCount.current > 0) {
      void fireConfetti();
      toast.success("🎉 Deal closed!", {
        description: "The pipeline is growing!",
        duration: 4000,
      });
    }
    prevDealsWonCount.current = dealsWonCount;
  }, [dealsWonCount]);

  const personalTodayActivities = React.useMemo(() => {
    if (!profile?.uid) return [];
    return activities.items.filter((a) => {
      const createdBy = (a as unknown as { createdBy?: string }).createdBy ?? a.repId;
      if (createdBy !== profile.uid) return false;
      const d = tsToDate(a.createdAt);
      return !!d && d >= todayStart;
    });
  }, [activities.items, profile?.uid, todayStart]);

  const streak = React.useMemo(() => {
    if (!profile?.uid) return 0;
    return calculateStreak(activities.items, profile.uid);
  }, [activities.items, profile?.uid, calculateStreak]);

  const hasActivityToday = personalTodayActivities.length > 0;

  const [onboardingDismissed, setOnboardingDismissed] = React.useState(false);
  const [onboardingStarted, setOnboardingStarted] = React.useState(false);
  const [showConfetti, setShowConfetti] = React.useState(false);

  const [leadDrawerOpen, setLeadDrawerOpen] = React.useState(false);
  const [leadDrawerId, setLeadDrawerId] = React.useState<string | null>(null);
  const [contactDrawerId, setContactDrawerId] = React.useState<string | null>(null);

  const selectedLead = React.useMemo(() => {
    if (!leadDrawerId) return null;
    return leads.items.find((l) => l.id === leadDrawerId) ?? null;
  }, [leads.items, leadDrawerId]);

  const selectedContact = React.useMemo(() => {
    if (!contactDrawerId) return null;
    return contacts.items.find((c) => c.id === contactDrawerId) ?? null;
  }, [contacts.items, contactDrawerId]);

  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem("bayan_onboarding_dismissed");
      setOnboardingDismissed(v === "true");
    } catch {
      // ignore
    }
  }, []);

  const contactsCount = contacts.items.length;
  const leadsCount = leads.items.length;
  const activitiesCount = activities.items.length;

  const onboardingProgress = React.useMemo(() => {
    const contactsDone = contactsCount > 0;
    const leadsDone = leadsCount > 0;
    const activitiesDone = activitiesCount > 0;
    const tasksDone = tasks.items.length > 0;
    return (
      (contactsDone ? 1 : 0) +
      (leadsDone ? 1 : 0) +
      (activitiesDone ? 1 : 0) +
      (tasksDone ? 1 : 0)
    );
  }, [contactsCount, leadsCount, activitiesCount, tasks.items.length]);

  const noDataYet = contactsCount === 0 && leadsCount === 0 && activitiesCount === 0;

  React.useEffect(() => {
    if (onboardingDismissed) return;
    if (onboardingStarted) return;
    if (!noDataYet) return;
    setOnboardingStarted(true);
  }, [onboardingDismissed, onboardingStarted, noDataYet]);

  React.useEffect(() => {
    if (onboardingDismissed) return;
    if (!onboardingStarted) return;
    if (onboardingProgress !== 4) return;

    setShowConfetti(true);
    try {
      window.localStorage.setItem("bayan_onboarding_dismissed", "true");
    } catch {
      // ignore
    }
    setOnboardingStarted(false);

    const t = window.setTimeout(() => setShowConfetti(false), 2600);
    return () => window.clearTimeout(t);
  }, [onboardingDismissed, onboardingStarted, onboardingProgress]);

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

    return sorted.slice(0, 5);
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
          t === "Note" ||
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {Array.from({ length: 45 }).map((_, i) => (
            <span
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className="bayan-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.4}s`,
                opacity: 0.95,
              }}
            />
          ))}
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">
              {(() => {
                const hour = new Date().getHours();
                if (hour >= 6 && hour < 12) return `Good morning, ${userFirstName} ☀️`;
                if (hour >= 12 && hour < 18)
                  return `Good afternoon, ${userFirstName} 👋`;
                return `Good evening, ${userFirstName} 🌙`;
              })()}
            </div>
            <div className="text-sm text-muted-foreground">
              Today’s KPIs, your pipeline, and what needs attention.
            </div>
            <div className="mt-2 text-sm text-muted-foreground">{todaySummary}</div>
            <div className="mt-1 text-sm">
              {hasActivityToday ? (
                <span className="font-semibold text-primary">
                  🔥 {streak} day streak
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Log an activity to keep your streak!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {onboardingStarted && !onboardingDismissed && onboardingProgress < 4 && (
        <Card className="relative overflow-hidden p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-semibold">
                Welcome to Bayan CRM 👋 Let&apos;s get you started
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Complete these 4 steps to set up your workspace
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOnboardingDismissed(true);
                setOnboardingStarted(false);
                try {
                  window.localStorage.setItem("bayan_onboarding_dismissed", "true");
                } catch {
                  // ignore
                }
              }}
            >
              Dismiss
            </Button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {onboardingProgress}/4 completed
              </span>
              <span>Progress</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary"
                style={{ width: `${(onboardingProgress / 4) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {contactsCount > 0 ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-muted-foreground">☐</span>
                )}
                <span
                  className={
                    contactsCount > 0 ? "line-through text-muted-foreground" : ""
                  }
                >
                  Add your first contact →
                </span>
              </div>
              {contactsCount > 0 ? null : <AddContactModal />}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {leadsCount > 0 ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-muted-foreground">☐</span>
                )}
                <span
                  className={
                    leadsCount > 0 ? "line-through text-muted-foreground" : ""
                  }
                >
                  Create your first lead →
                </span>
              </div>
              {leadsCount > 0 ? null : <AddLeadModal />}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {activitiesCount > 0 ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-muted-foreground">☐</span>
                )}
                <span
                  className={
                    activitiesCount > 0 ? "line-through text-muted-foreground" : ""
                  }
                >
                  Log your first activity →
                </span>
              </div>
              {activitiesCount > 0 ? null : (
                <Button size="sm" onClick={() => setLogActivityOpen(true)}>
                  Log Activity
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {tasks.items.length > 0 ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <span className="text-muted-foreground">☐</span>
                )}
                <span
                  className={
                    tasks.items.length > 0 ? "line-through text-muted-foreground" : ""
                  }
                >
                  Schedule a follow-up task →
                </span>
              </div>
              {tasks.items.length > 0 ? null : (
                <Link href="/tasks" className="inline-flex">
                  <Button size="sm">Add Task</Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/contacts"
          className="block"
        >
          <KpiCard
            label="Contacts Made today"
            value={kpis.contactsMadeToday}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
          />
        </Link>
        <Link
          href="/contacts?activity=site_visit"
          className="block"
        >
          <KpiCard
            label="Site Visits today"
            value={kpis.siteVisitsToday}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
          />
        </Link>
        <Link
          href="/leads?status=won"
          className="block"
        >
          <KpiCard
            label="Deals Won this month"
            value={dealsWonCount}
            subtext={
              dealsWonCount > 0
                ? `OMR ${dealsWonValue.toLocaleString("en-US", {
                    minimumFractionDigits: 3,
                  })}`
                : "Close your first deal!"
            }
            icon={Trophy}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
          />
        </Link>
        <Link
          href="/leads"
          className="block"
        >
          <KpiCard
            label="Pipeline value"
            value={formatOMR(kpis.pipelineValue)}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
          />
        </Link>
      </div>

      <LeadDetailDrawer
        lead={selectedLead}
        open={leadDrawerOpen}
        onOpenChange={(o) => {
          setLeadDrawerOpen(o);
          if (!o) setLeadDrawerId(null);
        }}
      />
      <ContactDetailDrawer
        contact={selectedContact}
        open={!!contactDrawerId}
        onOpenChange={(o) => {
          if (!o) setContactDrawerId(null);
        }}
      />
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
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Recent Activity</div>
            <Link href="/contacts" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
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
                    <button
                      type="button"
                      key={activity.id}
                      onClick={() => {
                        if (!activity.contactId) return;
                        setContactDrawerId(activity.contactId);
                      }}
                      className={`group flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors ${activity.contactId ? "cursor-pointer hover:bg-muted/50" : "cursor-default"} ${getActivityTypeBorderClass(activity.type)}`}
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
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">My open leads</div>
            <Link href="/leads" className="text-xs text-primary hover:underline">
              View all leads →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {myLeads.slice(0, 5).map((l) => {
              const c = l.contactId ? contactById.get(l.contactId) : null;
              const contactName =
                l.contactName ||
                (c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown Contact");
              const secondaryText = l.company || l.propertyType || "No details yet";
              const statusText = (l.status as string) || "";
              return (
                <div
                  key={l.id}
                  onClick={() => {
                    setLeadDrawerId(l.id);
                    setLeadDrawerOpen(true);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border/50 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{contactName}</p>
                    <p className="truncate text-xs text-muted-foreground">{secondaryText}</p>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                    <Badge
                      className={cn(
                        "text-[10px] capitalize",
                        (statusText === "new" || statusText === "Initial Contact") &&
                          "bg-blue-100 text-blue-700",
                        (statusText === "contacted" || statusText === "Send Brochure") &&
                          "bg-amber-100 text-amber-700",
                        (statusText === "qualified" || statusText === "Arrange Visit") &&
                          "bg-purple-100 text-purple-700"
                      )}
                    >
                      {l.status}
                    </Badge>
                    {(l.value ?? l.valueOmr ?? 0) > 0 ? (
                      <span className="text-xs font-medium font-mono">
                        {(l.value ?? l.valueOmr ?? 0).toLocaleString("en-US", {
                          minimumFractionDigits: 0,
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {myLeads.length === 0 && (
              <div className="text-sm text-muted-foreground">No open leads assigned to you.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

