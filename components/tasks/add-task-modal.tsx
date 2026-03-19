"use client";

import * as React from "react";
import { Timestamp, addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { tasksCol } from "@/lib/firestore";
import type { Task, TaskType } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads, useTeamMembers } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const TASK_TYPES: TaskType[] = ["follow_up", "call", "meeting", "site_visit", "admin"];

export function AddTaskModal() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const leads = useLeads();
  const team = useTeamMembers();

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [type, setType] = React.useState<TaskType>("follow_up");
  const [title, setTitle] = React.useState("");
  const [contactId, setContactId] = React.useState<string>("");
  const [leadId, setLeadId] = React.useState<string>("");
  const [dueDate, setDueDate] = React.useState("");
  const [dueTime, setDueTime] = React.useState("");
  const [assignedToId, setAssignedToId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (profile?.uid && !assignedToId) setAssignedToId(profile.uid);
  }, [profile?.uid, assignedToId]);

  function reset() {
    setType("follow_up");
    setTitle("");
    setContactId("");
    setLeadId("");
    setDueDate("");
    setDueTime("");
    setAssignedToId(profile?.uid ?? "");
    setNotes("");
  }

  async function onSave() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    setSubmitting(true);
    try {
      const dt = new Date(`${dueDate}T${dueTime || "09:00"}:00`);
      const payload = {
        type,
        title: title.trim(),
        notes: notes.trim(),
        contactId: contactId || "",
        leadId: leadId || "",
        assignedToId: assignedToId || profile?.uid || "",
        dueAt: Timestamp.fromDate(dt),
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies WithFieldValue<Task>;

      await addDoc(tasksCol, payload);
      toast.success("Task added");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Add Task</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Contact</Label>
              <Select value={contactId} onValueChange={setContactId}>
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
            <div className="grid gap-1.5">
              <Label>Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Due time</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Assigned to</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId}>
              <SelectTrigger>
                <SelectValue />
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
          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={submitting}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

