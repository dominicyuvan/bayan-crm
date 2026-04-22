import { tsToDate } from "@/lib/firestore";
import type { Activity, Lead, Task } from "./types";

export type NotificationType =
  | "overdue_task"
  | "lead_going_cold"
  | "deal_won"
  | "never_contacted";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  href: string; // where to navigate on click
  createdAt: Date;
  read: boolean;
  urgency: "high" | "medium" | "low";
  relatedId?: string; // leadId or taskId or contactId
}

export function buildNotifications(
  leads: Lead[],
  tasks: Task[],
  _activities: Activity[],
  userId: string,
  _userRole: string
): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = new Date();
  const currentUserId = (userId || "").trim();

  // Notifications should always be scoped to the signed-in user.
  if (!currentUserId) return notifications;

  // 1. OVERDUE TASKS
  const overdueTasks = tasks.filter((t) => {
    const taskStatus = (t.status || "").toLowerCase();
    if (taskStatus !== "pending" && taskStatus !== "overdue") return false;
    const taskAssignee = t.assignedToUid ?? t.assignedToId ?? "";
    if (taskAssignee !== currentUserId) return false;
    const due = tsToDate(t.dueAt);
    return !!due && due < now;
  });

  overdueTasks.forEach((task) => {
    const due = tsToDate(task.dueAt);
    const hoursOverdue = due
      ? Math.floor((now.getTime() - due.getTime()) / 3600000)
      : 0;
    notifications.push({
      id: `task_${task.id}`,
      type: "overdue_task",
      title: task.title || `${task.type} overdue`,
      description: task.contactName
        ? `${task.contactName} — ${
            hoursOverdue < 24
              ? `${hoursOverdue}h overdue`
              : `${Math.floor(hoursOverdue / 24)}d overdue`
          }`
        : `${
            hoursOverdue < 24
              ? `${hoursOverdue}h overdue`
              : `${Math.floor(hoursOverdue / 24)}d overdue`
          }`,
      href: "/tasks",
      createdAt: due || now,
      read: false,
      urgency: "high",
      relatedId: task.id,
    });
  });

  // 2. LEADS GOING COLD (not contacted in 7+ days)
  const coldLeads = leads
    .filter((l) => {
      const normalizedStatus = l.status.toLowerCase();
      if (normalizedStatus === "won" || normalizedStatus === "lost") return false;
      const leadAssignee = l.assignedToUid ?? l.assignedRepId ?? "";
      if (leadAssignee !== currentUserId) return false;
      const lastContact = tsToDate(l.lastContactedAt) ?? tsToDate(l.lastContactAt);
      if (!lastContact) return true;
      const days = Math.floor((now.getTime() - lastContact.getTime()) / 86400000);
      return days >= 7;
    })
    .slice(0, 5);

  coldLeads.forEach((lead) => {
    const lastContact = tsToDate(lead.lastContactedAt) ?? tsToDate(lead.lastContactAt);
    const days = lastContact
      ? Math.floor((now.getTime() - lastContact.getTime()) / 86400000)
      : null;
    notifications.push({
      id: `cold_${lead.id}`,
      type: "lead_going_cold",
      title: lead.contactName || "Lead",
      description: days
        ? `No contact in ${days} days — going cold`
        : "Never contacted — needs outreach",
      href: "/leads",
      createdAt: lastContact || now,
      read: false,
      urgency: days && days > 14 ? "high" : "medium",
      relatedId: lead.id,
    });
  });

  // 3. NEVER CONTACTED LEADS
  const neverContacted = leads
    .filter((l) => {
      const normalizedStatus = l.status.toLowerCase();
      if (normalizedStatus === "won" || normalizedStatus === "lost") return false;
      const leadAssignee = l.assignedToUid ?? l.assignedRepId ?? "";
      if (leadAssignee !== currentUserId) return false;
      return !l.lastContactedAt && !l.lastContactAt;
    })
    .slice(0, 3);

  neverContacted.forEach((lead) => {
    // Skip if already added as cold lead
    if (coldLeads.find((c) => c.id === lead.id)) return;
    notifications.push({
      id: `new_${lead.id}`,
      type: "never_contacted",
      title: lead.contactName || "Lead",
      description: "New lead — not yet contacted",
      href: "/leads",
      createdAt: tsToDate(lead.createdAt) || now,
      read: false,
      urgency: "medium",
      relatedId: lead.id,
    });
  });

  // 4. DEAL WON (recent wins from activities timeline)
  const recentWon = leads
    .filter((l) => {
      if (l.status.toLowerCase() !== "won") return false;
      const leadAssignee = l.assignedToUid ?? l.assignedRepId ?? "";
      if (leadAssignee !== currentUserId) return false;
      const closed = tsToDate(l.closedAt) ?? tsToDate(l.updatedAt);
      if (!closed) return false;
      return now.getTime() - closed.getTime() < 24 * 3600000;
    })
    .slice(0, 3);

  recentWon.forEach((lead) => {
    notifications.push({
      id: `won_${lead.id}`,
      type: "deal_won",
      title: `Deal won: ${lead.contactName || "Lead"}`,
      description: "Great work closing this deal!",
      href: "/leads?status=won",
      createdAt: tsToDate(lead.closedAt) ?? tsToDate(lead.updatedAt) ?? now,
      read: false,
      urgency: "low",
      relatedId: lead.id,
    });
  });

  // Sort: high urgency first, then by date
  return notifications.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
