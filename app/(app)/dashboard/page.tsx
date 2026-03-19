"use client";

import * as React from "react";
import { addDays, startOfDay, startOfMonth } from "date-fns";
import {
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { useActivities, useContacts, useLeads, useTasks } from "@/lib/firestore-provider";
import { firestore, tsToDate } from "@/lib/firestore";
import { cn, formatOMR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Check,
  Clock,
  AlertTriangle,
  Zap,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { AddContactModal } from "@/components/contacts/add-contact-modal";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { ContactDetailDrawer } from "@/components/contacts/contact-detail-drawer";
import { useLogActivityControl } from "@/lib/log-activity-control-context";
import { DEFAULT_CADENCES } from "@/lib/cadence-templates";
import type { Activity, Lead, Task } from "@/lib/types";
import { generateTopLeads } from "@/lib/lead-generator";

function KpiCard({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
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

function leadStatusClass(status: Lead["status"]) {
  switch (status) {
    case "Initial Contact":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Send Brochure":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "Arrange Visit":
      return "bg-background text-purple-700 border-purple-400";
    case "Won":
      return "bg-green-100 text-green-700 border-green-200";
    case "Lost":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "";
  }
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { setOpen: setLogActivityOpen } = useLogActivityControl();
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
    return leads.items.filter((l) => {
      const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
      return ownerUid === profile.uid && l.status !== "Won" && l.status !== "Lost";
    });
  }, [leads.items, profile?.uid]);

  const overdue = React.useMemo(
    () =>
      tasks.items.filter(
        (t) => t.isOverdue && (!isAgent || t.assignedToId === profile?.uid)
      ),
    [tasks.items, isAgent, profile?.uid]
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
        return !isAgent || ownerUid === profile?.uid;
      }
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
          t === "Note" ||
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
  const [overdueTaskId, setOverdueTaskId] = React.useState<string | null>(null);
  const [overdueOutcomeNote, setOverdueOutcomeNote] = React.useState("");
  const [isGenerating, setIsGenerating] = React.useState(false);

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

  async function completeTask(taskId: string, outcome: string | null = null) {
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: "completed",
        completedAt: serverTimestamp(),
        outcome: outcome ?? "",
        updatedAt: serverTimestamp(),
      });
      toast.success("Task completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete task");
    }
  }

  async function handleGenerateLeads() {
    if (!profile) return;
    if (contacts.items.length === 0) {
      toast.error("Add some contacts first before generating leads");
      return;
    }

    setIsGenerating(true);
    try {
      const topContacts = generateTopLeads(
        contacts.items,
        leads.items,
        activities.items,
        5
      );

      if (topContacts.length === 0) {
        toast.info("No cold contacts found — all contacts have active leads!");
        return;
      }

      const batchSize = 499;
      for (let i = 0; i < topContacts.length; i += batchSize) {
        const chunk = topContacts.slice(i, i + batchSize);
        const batch = writeBatch(firestore);

        chunk.forEach(({ contact, coldnessScore, reasons }) => {
          const leadRef = doc(collection(firestore, "leads"));
          const lastContactedAt =
            (contact as unknown as { lastContactedAt?: unknown }).lastContactedAt ??
            contact.lastContactAt ??
            null;

          batch.set(leadRef, {
            contactId: contact.id ?? "",
            contactName: `${contact.firstName} ${contact.lastName}`.trim(),
            contactPhone: contact.phone || "",
            company: contact.company || "",
            propertyType: "Unknown",
            location: "",
            value: 0,
            valueOmr: 0,
            status: "Initial Contact",
            temperature:
              coldnessScore > 60 ? "hot" : coldnessScore > 30 ? "warm" : "cold",
            score: coldnessScore,
            source: contact.source || "Generated",
            assignedTo: profile.displayName || "",
            assignedToUid: profile.uid || "",
            cadenceId: null,
            cadenceStep: 0,
            cadenceStepIndex: 0,
            cadenceNextDue: null,
            nextAction: "Initial contact",
            nextActionDue: null,
            daysInPipeline: 0,
            lastContactedAt: lastContactedAt ?? null,
            lastContactAt: lastContactedAt ?? null,
            notes: `Auto-generated lead. Reasons: ${reasons.join(", ")}`,
            generatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast.success(`${topContacts.length} leads generated! 🎯`, {
        description: `Check your Leads page — ${topContacts.length} cold contacts are ready to work`,
        duration: 5000,
        action: {
          label: "View Leads",
          onClick: () => {
            window.location.href = "/leads";
          },
        },
      });
    } catch (err) {
      console.error("Generate leads error:", err);
      toast.error(
        `Failed to generate leads: ${
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message ?? "Unknown error")
            : "Unknown error"
        }`
      );
    } finally {
      setIsGenerating(false);
    }
  }

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

  const focus = React.useMemo(() => {
    const now = new Date();
    const todayEnd = addDays(todayStart, 1);
    const sevenDaysAgo = addDays(todayStart, -7);

    const visibleTasks = tasks.items.filter(
      (t) => !isAgent || t.assignedToId === profile?.uid
    );

    const visibleLeads = leads.items.filter((l) => {
      const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
      return !isAgent || ownerUid === profile?.uid;
    });

    const shareBrochureActions = visibleLeads
      .filter((l) => l.status === "Send Brochure")
      .map((l) => {
        const contactId = l.contactId;
        if (!contactId) return null;

        const relevantActivities = activities.items.filter((a) => {
          const aContactId = (a as unknown as { contactId?: string | null }).contactId ?? null;
          if (aContactId !== contactId) return false;
          if (isAgent) {
            const createdBy = (a as unknown as { createdBy?: string }).createdBy;
            return createdBy === profile?.uid;
          }
          return true;
        });

        const latestActivityMs =
          relevantActivities.reduce((max, a) => {
            const t = a.createdAt?.toMillis?.() ?? 0;
            return t > max ? t : max;
          }, 0) || 0;

        const baseMs =
          latestActivityMs ||
          tsToDate(l.lastContactAt ?? l.createdAt)?.getTime() ||
          now.getTime();
        const hoursNoActivity = (now.getTime() - baseMs) / (3600 * 1000);
        if (hoursNoActivity <= 24) return null;

        const contact = contactById.get(contactId) ?? null;
        const name = contact
          ? `${contact.firstName} ${contact.lastName}`
          : l.propertyType ?? "Lead";

        return {
          key: `share-${l.id}`,
          priority: 0,
          kind: "share_brochure" as const,
          tone: "amber" as const,
          title: `Share Brochure — ${Math.floor(hoursNoActivity)}h no activity`,
          subtitle: `${name}${l.location ? ` • ${l.location}` : ""}`,
          leadId: l.id as string,
          hoursNoActivity,
        };
      })
      .filter(
        (x): x is {
          key: string;
          priority: number;
          kind: "share_brochure";
          tone: "amber";
          title: string;
          subtitle: string;
          leadId: string;
          hoursNoActivity: number;
        } => !!x
      )
      .sort((a, b) => b.hoursNoActivity - a.hoursNoActivity);

    const overdueTaskActions = visibleTasks
      .filter((t) => t.isOverdue)
      .sort((a, b) => (a.dueAt.toMillis() ?? 0) - (b.dueAt.toMillis() ?? 0))
      .slice(0, 5)
      .map((t) => {
        const due = tsToDate(t.dueAt);
        const daysOverdue = due
          ? Math.max(1, Math.round((todayStart.getTime() - due.getTime()) / 86400000))
          : 1;
        const contact =
          t.contactId && contactById.get(t.contactId)
            ? contactById.get(t.contactId)
            : null;
        const lead = t.leadId ? visibleLeads.find((l) => l.id === t.leadId) ?? null : null;

        return {
          key: `overdue-${t.id}`,
          priority: 1,
          kind: "overdue_task" as const,
          tone: "red" as const,
          title: `${t.title || t.type} — ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`,
          subtitle: lead
            ? `${contact ? `${contact.firstName} ${contact.lastName}` : "Lead"} • ${lead.propertyType ?? "Lead"}`
            : contact
            ? `${contact.firstName} ${contact.lastName}`
            : "",
          taskId: t.id,
        };
      });

    const coldLeadActions = visibleLeads
      .filter((l) => l.status !== "Won" && l.status !== "Lost")
      .map((l) => {
        const last = tsToDate(l.lastContactAt) ?? tsToDate(l.createdAt);
        if (!last) return null;
        const daysNoContact = Math.floor(
          (todayStart.getTime() - last.getTime()) / 86400000
        );
        return { lead: l, daysNoContact };
      })
      .filter(
        (x): x is { lead: (typeof leads.items)[number]; daysNoContact: number } =>
          !!x && x.daysNoContact >= 7 && x.lead.status !== "Won" && x.lead.status !== "Lost"
      )
      .sort((a, b) => b.daysNoContact - a.daysNoContact)
      .slice(0, 5)
      .map(({ lead, daysNoContact }) => {
        const contact = lead.contactId ? contactById.get(lead.contactId) ?? null : null;
        const name = contact ? `${contact.firstName} ${contact.lastName}` : lead.propertyType ?? "Lead";
        return {
          key: `cold-${lead.id}`,
          priority: 2,
          kind: "cold_lead" as const,
          tone: "amber" as const,
          title: `Call ${name} — ${daysNoContact} days no contact`,
          subtitle: `${lead.propertyType ?? "Lead"}${lead.location ? ` • ${lead.location}` : ""}`,
          leadId: lead.id as string,
        };
      });

    const dueTodayTaskActions = visibleTasks
      .filter((t) => {
        if (t.status === "completed") return false;
        const due = tsToDate(t.dueAt);
        return !!due && due >= todayStart && due < todayEnd;
      })
      .sort((a, b) => a.dueAt.toMillis() - b.dueAt.toMillis())
      .slice(0, 5)
      .map((t) => {
        const contact =
          t.contactId && contactById.get(t.contactId)
            ? contactById.get(t.contactId)
            : null;
        const lead = t.leadId ? visibleLeads.find((l) => l.id === t.leadId) ?? null : null;
        return {
          key: `todaytask-${t.id}`,
          priority: 3,
          kind: "due_today_task" as const,
          tone: "blue" as const,
          title: `${t.title || t.type} — due today`,
          subtitle: lead
            ? `${contact ? `${contact.firstName} ${contact.lastName}` : "Lead"} • ${lead.propertyType ?? "Lead"}`
            : contact
            ? `${contact.firstName} ${contact.lastName}`
            : "",
          taskId: t.id,
        };
      });

    const cadenceLeadActions = visibleLeads
      .filter((l) => l.cadenceId && l.status !== "Won" && l.status !== "Lost")
      .map((l) => {
        const cadence = DEFAULT_CADENCES.find((c) => c.id === l.cadenceId);
        if (!cadence) return null;
        const stepIndex = l.cadenceStepIndex ?? 0;
        const step = cadence.steps[stepIndex] ?? cadence.steps[0];
        const base = tsToDate(l.createdAt);
        if (!base) return null;
        const due = addDays(base, step.dayOffset);
        return { lead: l, due, cadenceName: cadence.name };
      })
      .filter(
        (x): x is {
          lead: (typeof leads.items)[number];
          due: Date;
          cadenceName: string;
        } => !!x && x.due <= now
      )
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 5)
      .map(({ lead, due, cadenceName }) => {
        const contact = lead.contactId ? contactById.get(lead.contactId) ?? null : null;
        const name = contact ? `${contact.firstName} ${contact.lastName}` : lead.propertyType ?? "Lead";
        return {
          key: `cad-${lead.id}`,
          priority: 4,
          kind: "cadence_lead" as const,
          tone: "blue" as const,
          title: `Cadence next action: ${name}`,
          subtitle: `${cadenceName}${due ? ` • due ${due.toLocaleDateString()}` : ""}`,
          leadId: lead.id as string,
        };
      });

    const selected = [
      ...shareBrochureActions,
      ...overdueTaskActions,
      ...coldLeadActions,
      ...dueTodayTaskActions,
      ...cadenceLeadActions,
    ].slice(0, 3);

    return {
      selected,
      totalUrgent: selected.length,
      remainingSlots: Math.max(0, 3 - selected.length),
    };
  }, [
    tasks.items,
    leads.items,
    activities.items,
    isAgent,
    profile?.uid,
    todayStart,
    contactById,
  ]);

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
          <Button
            onClick={() => void handleGenerateLeads()}
            disabled={isGenerating}
            variant="outline"
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Leads"}
          </Button>
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

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Your focus for today</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {focus.selected.length === 0 ? (
          <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            Great work! No urgent actions today 🎉
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {focus.selected.map((action) => (
              <div
                key={action.key}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {action.kind === "share_brochure" && (
                      <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                    )}
                    {action.tone === "red" && (
                      <div className="rounded-lg bg-red-50 p-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                    )}
                    {action.tone === "amber" && action.kind !== "share_brochure" && (
                      <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                        <Phone className="h-5 w-5" />
                      </div>
                    )}
                    {action.tone === "blue" && (
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                        <Clock className="h-5 w-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-sm font-medium">{action.title}</div>
                      {action.subtitle ? (
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {action.subtitle}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {action.kind === "overdue_task" ? (
                      <Popover
                        open={overdueTaskId === action.taskId}
                        onOpenChange={(o) => setOverdueTaskId(o ? action.taskId : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => setOverdueOutcomeNote("")}
                          >
                            Do it →
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80">
                          <div className="grid gap-2">
                            <div className="text-sm font-medium">Outcome note (optional)</div>
                            <Textarea
                              value={overdueOutcomeNote}
                              placeholder="Short note for the task completion"
                              onChange={(e) => setOverdueOutcomeNote(e.target.value)}
                              rows={3}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setOverdueTaskId(null);
                                  setOverdueOutcomeNote("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  void completeTask(action.taskId, overdueOutcomeNote);
                                  setOverdueTaskId(null);
                                  setOverdueOutcomeNote("");
                                }}
                              >
                                Complete
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : action.kind === "due_today_task" ? (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          void completeTask(action.taskId);
                        }}
                      >
                        Do it →
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          setLeadDrawerId(action.leadId);
                          setLeadDrawerOpen(true);
                        }}
                      >
                        Do it →
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {focus.remainingSlots > 0 ? (
              <div className="rounded-lg border bg-muted/20 p-4 md:col-span-2">
                <div className="text-sm font-medium">You&apos;re all caught up here 🎉</div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          href="/tasks"
          className="block"
        >
          <KpiCard
            label="Follow Ups today"
            value={kpis.followUpsToday}
            className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-md"
          />
        </Link>
        <Link
          href="/leads?status=won"
          className="block"
        >
          <KpiCard
            label="Deals Won this month"
            value={kpis.dealsWonThisMonth}
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
              const contactName = c
                ? `${c.firstName} ${c.lastName}`.trim()
                : "Unknown contact";
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => {
                    setLeadDrawerId(l.id);
                    setLeadDrawerOpen(true);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">
                      {contactName}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {l.propertyType ?? "Lead"} {l.location ? `• ${l.location}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={leadStatusClass(l.status)}>
                      {l.status}
                    </Badge>
                    <div className="font-mono text-sm font-semibold">
                      {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                    </div>
                  </div>
                </button>
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

