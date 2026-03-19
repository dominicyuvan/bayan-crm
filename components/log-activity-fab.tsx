"use client";

import * as React from "react";
import { Timestamp, addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { activitiesCol, tasksCol } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads, useTeamMembers } from "@/lib/firestore-provider";
import type { Activity, Task } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Mode = "activity" | "task";

export function LogActivityFab() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const leads = useLeads();
  const team = useTeamMembers();

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("activity");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [contactId, setContactId] = React.useState<string | "">("");
  const [leadId, setLeadId] = React.useState<string | "">("");
  const [dueDate, setDueDate] = React.useState("");
  const [dueTime, setDueTime] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState<string | "">("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (profile?.uid && !assignedToId) setAssignedToId(profile.uid);
  }, [profile?.uid, assignedToId]);

  function reset() {
    setTitle("");
    setNotes("");
    setContactId("");
    setLeadId("");
    setDueDate("");
    setDueTime("");
    setSubmitting(false);
  }

  async function onSave() {
    if (!profile?.uid) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "activity") {
        const payload = {
          type: "note",
          title: title.trim(),
          notes: notes.trim(),
          contactId: contactId || "",
          leadId: leadId || "",
          repId: profile.uid,
          occurredAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        } satisfies WithFieldValue<Activity>;
        await addDoc(activitiesCol, payload);
        toast.success("Activity logged");
      } else {
        if (!dueDate) {
          toast.error("Due date is required");
          return;
        }
        const dt = new Date(`${dueDate}T${dueTime || "09:00"}:00`);
        const payload = {
          type: "follow_up",
          title: title.trim(),
          notes: notes.trim(),
          contactId: contactId || "",
          leadId: leadId || "",
          assignedToId: assignedToId || profile.uid,
          dueAt: Timestamp.fromDate(dt),
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } satisfies WithFieldValue<Task>;
        await addDoc(tasksCol, payload);
        toast.success("Task scheduled");
      }

      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        size="icon-lg"
        className="fixed bottom-5 right-5 z-50 shadow-lg"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-5" />
        <span className="sr-only">Log activity or schedule task</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => (setOpen(v), !v && reset())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick add</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "activity" ? "default" : "outline"}
              onClick={() => setMode("activity")}
              className="flex-1"
            >
              Log Activity
            </Button>
            <Button
              type="button"
              variant={mode === "task" ? "default" : "outline"}
              onClick={() => setMode("task")}
              className="flex-1"
            >
              Schedule Task
            </Button>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={(v) => setContactId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} {c.company ? `• ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Lead</Label>
              <Select value={leadId} onValueChange={(v) => setLeadId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {leads.items.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {(l.propertyType ?? "Lead") + (l.location ? ` • ${l.location}` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {mode === "task" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Due date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Due time</Label>
                    <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Assigned to</Label>
                  <Select value={assignedToId} onValueChange={(v) => setAssignedToId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rep" />
                    </SelectTrigger>
                    <SelectContent>
                      {team.items.map((m) => (
                        <SelectItem key={m.id} value={m.id ?? m.email}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <Button onClick={onSave} disabled={submitting}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

