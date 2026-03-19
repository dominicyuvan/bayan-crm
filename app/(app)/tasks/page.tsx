"use client";

import * as React from "react";
import { isAfter, isBefore, isSameDay, startOfDay } from "date-fns";
import { Timestamp, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useTasks, useContacts, useLeads } from "@/lib/firestore-provider";
import { db } from "@/lib/firebase";
import { tsToDate } from "@/lib/firestore";
import { AddTaskModal } from "@/components/tasks/add-task-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { Check } from "lucide-react";

export default function TasksPage() {
  const { profile } = useAuth();
  const tasksState = useTasks();
  const contacts = useContacts();
  const leads = useLeads();

  const role = profile?.role ?? "agent";
  const isAgent = role === "agent";

  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | "completed">("all");
  const [finalNoteTaskId, setFinalNoteTaskId] = React.useState<string | null>(null);
  const [finalNote, setFinalNote] = React.useState("");
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(null);

  const today = React.useMemo(() => startOfDay(new Date()), []);
  const isMobile = useIsMobile();

  const tasks = React.useMemo(() => {
    return tasksState.items.filter((t) => {
      if (isAgent && t.assignedToId !== profile?.uid) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasksState.items, isAgent, profile?.uid, statusFilter]);

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

  async function updateLeadAfterQuickOutcome({
    leadId,
    nextLeadStatus,
  }: {
    leadId: string | undefined;
    nextLeadStatus?: "Arrange Visit" | "Lost";
  }) {
    if (!leadId) return;
    const base = {
      lastContactAt: serverTimestamp() as unknown as Timestamp,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    };
    if (nextLeadStatus) {
      await updateDoc(doc(db, "leads", leadId), {
        ...base,
        status: nextLeadStatus,
      });
      return;
    }
    await updateDoc(doc(db, "leads", leadId), base);
  }

  async function handleQuickOutcomeInterested(taskId: string, leadId?: string) {
    setUpdatingTaskId(taskId);
    try {
      if (leadId) {
        await updateLeadAfterQuickOutcome({ leadId, nextLeadStatus: "Arrange Visit" });
      }
      await updateDoc(doc(db, "tasks", taskId), {
        status: "completed",
        completedAt: serverTimestamp() as unknown as Timestamp,
        outcome: "Interested",
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Marked Interested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update outcome");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleQuickOutcomeBusy(taskId: string, leadId?: string) {
    setUpdatingTaskId(taskId);
    try {
      if (leadId) {
        await updateLeadAfterQuickOutcome({ leadId });
      }

      const dueAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
      await updateDoc(doc(db, "tasks", taskId), {
        dueAt,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Follow-up scheduled (+24h)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reschedule task");
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleQuickOutcomeSaveNotInterested(taskId: string, leadId?: string) {
    const note = finalNote.trim();
    setUpdatingTaskId(taskId);
    try {
      if (leadId) {
        await updateLeadAfterQuickOutcome({ leadId, nextLeadStatus: "Lost" });
      }
      await updateDoc(doc(db, "tasks", taskId), {
        status: "completed",
        completedAt: serverTimestamp() as unknown as Timestamp,
        outcome: note ? note : "Not Interested",
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Marked Not Interested");
      setFinalNoteTaskId(null);
      setFinalNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save final note");
    } finally {
      setUpdatingTaskId(null);
    }
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
          {tasks.map((t) => {
            const contact =
              t.contactId && contacts.items.find((c) => c.id === t.contactId);
            const lead = t.leadId && leads.items.find((l) => l.id === t.leadId);
            return (
              <Card key={t.id} className="border bg-card p-3 text-sm">
                <div className="font-medium">{t.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t.type.replace("_", " ")} •{" "}
                  {tsToDate(t.dueAt)?.toLocaleString() ?? ""}
                </div>
                {contact && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {contact.firstName} {contact.lastName}{" "}
                    {contact.company ? `• ${contact.company}` : ""}
                  </div>
                )}
                {lead && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Lead: {lead.propertyType ?? "Lead"}{" "}
                    {lead.location ? `• ${lead.location}` : ""}
                  </div>
                )}
                {t.status !== "completed" ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="xs"
                        onClick={() => void handleQuickOutcomeInterested(t.id, t.leadId)}
                        disabled={updatingTaskId === t.id}
                      >
                        Interested
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => void handleQuickOutcomeBusy(t.id, t.leadId)}
                        disabled={updatingTaskId === t.id}
                      >
                        Busy
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => {
                          setFinalNoteTaskId(t.id);
                          setFinalNote("");
                        }}
                        disabled={updatingTaskId === t.id}
                      >
                        Not Interested
                      </Button>
                    </div>

                    {finalNoteTaskId === t.id && (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          value={finalNote}
                          placeholder="Final note for marking lost (optional)"
                          onChange={(e) => setFinalNote(e.target.value)}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => {
                              setFinalNoteTaskId(null);
                              setFinalNote("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            onClick={() => void handleQuickOutcomeSaveNotInterested(t.id, t.leadId)}
                            disabled={updatingTaskId === t.id}
                          >
                            Save & Close
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {t.outcome ? (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        Outcome: {t.outcome}
                      </div>
                    ) : null}
                    {t.notes && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">{t.notes}</div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
          {tasks.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">
              No tasks.
            </div>
          )}
        </div>
      </Card>
    );
  }

  function MobileTaskCard({
    task,
    onComplete,
  }: {
    task: (typeof tasks)[number];
    onComplete: (id: string) => void;
  }) {
    const isDone = task.status === "completed";
    const due = tsToDate(task.dueAt);
    const isOverdue = !isDone && !!due && isBefore(due, today);
    const contact =
      task.contactId && contacts.items.find((c) => c.id === task.contactId);
    return (
      <div
        className={`rounded-xl border bg-card p-4 ${
          isOverdue ? "border-l-4 border-l-red-500" : "border-border"
        } ${isDone ? "opacity-50" : ""}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center">
            {isDone ? <Check className="h-4 w-4 text-primary" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${
                isDone ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title || task.type}
            </p>
            {contact && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {contact.firstName} {contact.lastName}
              </p>
            )}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span
                className={
                  isOverdue
                    ? "font-medium text-red-600"
                    : "text-muted-foreground"
                }
              >
                {isOverdue
                  ? "⚠️ Overdue"
                  : due
                  ? due.toLocaleString()
                  : ""}
              </span>
            </div>
          </div>
        </div>

        {task.status !== "completed" ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Button
                size="xs"
                onClick={() =>
                  void handleQuickOutcomeInterested(task.id, task.leadId)
                }
                disabled={updatingTaskId === task.id}
              >
                Interested
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => void handleQuickOutcomeBusy(task.id, task.leadId)}
                disabled={updatingTaskId === task.id}
              >
                Busy
              </Button>
              <Button
                size="xs"
                variant="destructive"
                onClick={() => {
                  setFinalNoteTaskId(task.id);
                  setFinalNote("");
                }}
                disabled={updatingTaskId === task.id}
              >
                Not Interested
              </Button>
            </div>
            {finalNoteTaskId === task.id && (
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  value={finalNote}
                  placeholder="Final note (optional)"
                  onChange={(e) => setFinalNote(e.target.value)}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setFinalNoteTaskId(null);
                      setFinalNote("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    onClick={() => void handleQuickOutcomeSaveNotInterested(task.id, task.leadId)}
                    disabled={updatingTaskId === task.id}
                  >
                    Save & Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : task.outcome ? (
          <div className="mt-3 text-xs text-muted-foreground">Outcome: {task.outcome}</div>
        ) : null}
      </div>
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
        <AddTaskModal />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="grid grid-cols-2 gap-2 sm:w-auto sm:grid-cols-3">
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "all" | "pending" | "completed")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {tasks.map((t) => (
            <MobileTaskCard
              key={t.id}
              task={t}
              onComplete={() => undefined}
            />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No tasks.
            </div>
          )}
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

