"use client";

import * as React from "react";
import { isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { Timestamp, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTasks, useContacts } from "@/lib/firestore-provider";
import { db } from "@/lib/firebase";
import { tsToDate } from "@/lib/firestore";
import { AddTaskModal } from "@/components/tasks/add-task-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check, Clock, FileText, MapPin, Phone, Users } from "lucide-react";

export default function TasksPage() {
  const { profile } = useAuth();
  const tasksState = useTasks();
  const contacts = useContacts();

  const role = profile?.role ?? "agent";
  const isAgent = role === "agent";

  const [q, setQ] = React.useState("");
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null);

  const today = React.useMemo(() => startOfDay(new Date()), []);
  const isMobile = useIsMobile();

  const tasks = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return tasksState.items.filter((t) => {
      if (isAgent && t.assignedToId !== profile?.uid) return false;
      if (!query) return true;
      const contact = t.contactId ? contacts.items.find((c) => c.id === t.contactId) : null;
      const contactName = contact ? `${contact.firstName} ${contact.lastName}`.toLowerCase() : "";
      return (
        (t.title ?? "").toLowerCase().includes(query) ||
        (t.type ?? "").toLowerCase().includes(query) ||
        (t.notes ?? "").toLowerCase().includes(query) ||
        contactName.includes(query)
      );
    });
  }, [tasksState.items, isAgent, profile?.uid, q, contacts.items]);

  const grouped = React.useMemo(() => {
    const overdue: typeof tasks = [];
    const todayGroup: typeof tasks = [];
    const upcoming: typeof tasks = [];
    const completed: typeof tasks = [];

    for (const t of tasks) {
      if (t.status === "completed") {
        completed.push(t);
        continue;
      }
      const due = tsToDate(t.dueAt);
      if (!due) {
        upcoming.push(t);
        continue;
      }
      if (isBefore(due, today)) overdue.push(t);
      else if (isSameDay(due, today)) todayGroup.push(t);
      else if (isAfter(due, today)) upcoming.push(t);
    }
    return { overdue, today: todayGroup, upcoming, completed };
  }, [tasks, today]);

  async function completeTask(taskId: string) {
    setUpdatingTaskId(taskId);
    try {
      await updateDoc(doc(db, "tasks", taskId), {
        status: "completed",
        completedAt: serverTimestamp() as unknown as Timestamp,
        outcome: "",
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Task completed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete task");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function taskTypeVisual(type: string) {
    switch (type) {
      case "call":
      case "Call":
        return Phone;
      case "site_visit":
      case "Site Visit":
        return MapPin;
      case "meeting":
      case "Meeting":
        return Users;
      case "note":
      case "Note":
        return FileText;
      default:
        return Clock;
    }
  }

  function CompactTaskCard({ task }: { task: (typeof tasks)[number] }) {
    const due = tsToDate(task.dueAt);
    const isDone = task.status === "completed";
    const isOverdue = !isDone && !!due && isBefore(due, today);
    const contact = task.contactId ? contacts.items.find((c) => c.id === task.contactId) : null;
    const contactName =
      task.contactName ||
      (contact ? `${contact.firstName} ${contact.lastName}`.trim() : "");
    const Icon = taskTypeVisual(task.type);

    return (
      <div
        className={`rounded-lg border p-3 ${isOverdue ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"} ${
          isDone ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            disabled={isDone || updatingTaskId === task.id}
            onClick={() => void completeTask(task.id)}
            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
              isDone ? "border-primary bg-primary" : "border-muted-foreground"
            }`}
            aria-label="Complete task"
          >
            {isDone ? <Check className="h-3 w-3 text-white" /> : null}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <p
                className={`truncate text-sm font-medium ${
                  isDone ? "line-through text-muted-foreground" : ""
                }`}
              >
                {task.type}
              </p>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {contactName || "No contact linked"}
            </p>
            <p
              className={`mt-1 text-xs ${
                isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
              }`}
            >
              {due ? due.toLocaleString() : "No due date"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function TaskColumn({
    title,
    tasks,
    tone,
  }: {
    title: string;
    tasks: typeof grouped.overdue;
    tone?: "danger";
  }) {
    const border =
      tone === "danger" ? "border-destructive/40 bg-destructive/5" : "border-border";
    return (
      <Card className={`flex flex-1 flex-col gap-2 p-3 ${border}`}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
          <div className="text-xs text-muted-foreground">{tasks.length}</div>
        </div>
        <div className="mt-1 space-y-2">
          {tasks.map((t) => (
            <CompactTaskCard key={t.id} task={t} />
          ))}
          {tasks.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No tasks.
            </div>
          )}
        </div>
      </Card>
    );
  }

  if (tasksState.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-64" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Tasks</div>
          <div className="text-sm text-muted-foreground">
            Follow-ups, calls, and site visits, grouped by urgency.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks..."
            className="w-full sm:w-72"
          />
          <AddTaskModal />
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          <TaskColumn title="Overdue" tasks={grouped.overdue} tone="danger" />
          <TaskColumn title="Today" tasks={grouped.today} />
          <TaskColumn title="Upcoming" tasks={grouped.upcoming} />
          <TaskColumn title="Completed" tasks={grouped.completed} />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-4">
          <TaskColumn title="Overdue" tasks={grouped.overdue} tone="danger" />
          <TaskColumn title="Today" tasks={grouped.today} />
          <TaskColumn title="Upcoming" tasks={grouped.upcoming} />
          <TaskColumn title="Completed" tasks={grouped.completed} />
        </div>
      )}
    </div>
  );
}

