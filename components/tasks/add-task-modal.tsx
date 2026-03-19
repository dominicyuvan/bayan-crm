"use client";

import * as React from "react";
import { Timestamp, addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { tasksCol } from "@/lib/firestore";
import type { Task, TaskType } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useContacts } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, MapPin, Phone, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskTypeChoice = "Call" | "Note" | "Site Visit" | "Meeting";

const TASK_TYPE_DEFS: Record<
  TaskTypeChoice,
  {
    label: TaskTypeChoice;
    Icon: React.ComponentType<{ className?: string }>;
    selectedClasses: string;
  }
> = {
  Call: {
    label: "Call",
    Icon: Phone,
    selectedClasses: "border-rose-400 bg-rose-50 text-rose-500",
  },
  Note: {
    label: "Note",
    Icon: FileText,
    selectedClasses: "border-blue-400 bg-blue-50 text-blue-500",
  },
  "Site Visit": {
    label: "Site Visit",
    Icon: MapPin,
    selectedClasses: "border-green-400 bg-green-50 text-green-500",
  },
  Meeting: {
    label: "Meeting",
    Icon: Users,
    selectedClasses: "border-amber-400 bg-amber-50 text-amber-500",
  },
};

function mapPrefillTypeToChoice(type?: TaskType): TaskTypeChoice | null {
  switch (type) {
    case "call":
    case "Call":
      return "Call";
    case "site_visit":
    case "Site Visit":
      return "Site Visit";
    case "meeting":
    case "Meeting":
      return "Meeting";
    case "follow_up":
    case "admin":
    case "Note":
      return "Note";
    default:
      return null;
  }
}

export type AddTaskModalProps = {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  prefill?: Partial<{
    type: TaskType;
    title: string;
    contactId: string;
    leadId: string;
    dueDate: string; // YYYY-MM-DD
    dueTime: string; // HH:mm
    assignedToId: string;
    notes: string;
  }>;
};

export function AddTaskModal({
  externalOpen,
  onExternalOpenChange,
  prefill,
}: AddTaskModalProps) {
  const { profile } = useAuth();
  const contacts = useContacts();

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled =
    typeof externalOpen === "boolean" && typeof onExternalOpenChange === "function";
  const open = isControlled ? externalOpen : uncontrolledOpen;

  const [submitting, setSubmitting] = React.useState(false);

  const [selectedType, setSelectedType] = React.useState<TaskTypeChoice | null>(null);
  const [typeGridShaking, setTypeGridShaking] = React.useState(false);
  const [typeError, setTypeError] = React.useState<string | null>(null);

  const [selectedContactId, setSelectedContactId] = React.useState<string>("");
  const [selectedContactName, setSelectedContactName] = React.useState("");
  const [contactSearch, setContactSearch] = React.useState("");
  const [showContactResults, setShowContactResults] = React.useState(false);

  const [dueDate, setDueDate] = React.useState("");
  const [dueTime, setDueTime] = React.useState("");
  const [notes, setNotes] = React.useState("");

  function reset() {
    setSelectedType(null);
    setTypeError(null);
    setTypeGridShaking(false);
    setSelectedContactId("");
    setSelectedContactName("");
    setContactSearch("");
    setShowContactResults(false);
    setDueDate("");
    setDueTime("");
    setNotes("");
  }

  const shakeTimerRef = React.useRef<number | null>(null);
  const shakeTypeGrid = React.useCallback(() => {
    setTypeError("Select an activity type");
    setTypeGridShaking(true);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setTypeGridShaking(false), 340);
  }, []);

  const didApplyPrefillRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      didApplyPrefillRef.current = false;
      return;
    }
    if (didApplyPrefillRef.current) return;
    if (!prefill) {
      didApplyPrefillRef.current = true;
      return;
    }

    const mapped = mapPrefillTypeToChoice(prefill.type);
    if (mapped) setSelectedType(mapped);
    if (typeof prefill.contactId === "string") {
      setSelectedContactId(prefill.contactId);
      const c = contacts.items.find((x) => x.id === prefill.contactId);
      const name = c ? `${c.firstName} ${c.lastName}`.trim() : "";
      setSelectedContactName(name);
      setContactSearch(name);
    }
    if (typeof prefill.dueDate === "string") setDueDate(prefill.dueDate);
    if (typeof prefill.dueTime === "string") setDueTime(prefill.dueTime);
    if (typeof prefill.notes === "string") setNotes(prefill.notes);

    didApplyPrefillRef.current = true;
  }, [open, prefill, contacts.items]);

  React.useEffect(() => {
    return () => {
      if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    };
  }, []);

  const filteredContacts = React.useMemo(() => {
    if (!contactSearch || contactSearch.length < 1) return [];
    const q = contactSearch.toLowerCase();
    return contacts.items
      .filter((c) => {
        const fullName = `${c.firstName ?? ""} ${c.lastName ?? ""}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [contacts.items, contactSearch]);

  async function onSave() {
    if (!selectedType) {
      shakeTypeGrid();
      return;
    }
    if (!profile?.uid) {
      toast.error("You must be logged in");
      return;
    }
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    setSubmitting(true);
    try {
      const combinedDateTime = new Date(`${dueDate}T${dueTime || "09:00"}:00`);
      const payload = {
        type: selectedType,
        title: selectedContactName
          ? `${selectedType} — ${selectedContactName}`
          : selectedType,
        notes: notes.trim() || "",
        contactId: selectedContactId || null,
        contactName: selectedContactName || null,
        leadId: null,
        assignedTo: profile?.displayName || "",
        assignedToUid: profile?.uid || "",
        assignedToId: profile?.uid || "",
        dueAt: Timestamp.fromDate(combinedDateTime),
        status: "pending",
        outcome: null,
        completedAt: null,
        createdBy: profile?.uid || "",
        createdByName: profile?.displayName || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies WithFieldValue<Task>;

      await addDoc(tasksCol, payload);
      toast.success(
        `Task scheduled for ${combinedDateTime.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`
      );
      if (isControlled) onExternalOpenChange?.(false);
      else setUncontrolledOpen(false);
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
        if (isControlled) onExternalOpenChange?.(v);
        else setUncontrolledOpen(v);
        if (!v) reset();
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm">Add Task</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Schedule task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Activity Type</Label>
            <div
              className={cn(
                "grid grid-cols-2 gap-2",
                typeGridShaking ? "bayan-shake" : ""
              )}
            >
              {(Object.keys(TASK_TYPE_DEFS) as TaskTypeChoice[]).map((t) => {
                const def = TASK_TYPE_DEFS[t];
                const selected = selectedType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedType(t);
                      setTypeError(null);
                    }}
                    className={cn(
                      "rounded-2xl border-2 p-3 min-h-[80px] flex flex-col items-center justify-center",
                      selected
                        ? def.selectedClasses
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    <def.Icon className="h-7 w-7 text-current" />
                    <span className="mt-1 text-sm font-medium">{def.label}</span>
                  </button>
                );
              })}
            </div>
            {typeError ? (
              <div className="text-xs text-destructive">{typeError}</div>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label>Contact (optional)</Label>
            {!selectedContactId ? (
              <div className="relative">
                <Input
                  placeholder="Search by name or phone..."
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactResults(e.target.value.length > 0);
                  }}
                  className="h-10"
                />
                {showContactResults && filteredContacts.length > 0 ? (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
                    {filteredContacts.slice(0, 5).map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          const name = `${contact.firstName} ${contact.lastName}`.trim();
                          setSelectedContactId(contact.id);
                          setSelectedContactName(name);
                          setContactSearch(name);
                          setShowContactResults(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left border-b last:border-0"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                          {contact.firstName?.[0] ?? ""}
                          {contact.lastName?.[0] ?? ""}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {contact.phone || contact.company}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                  {selectedContactName[0] ?? ""}
                </div>
                <span className="text-sm font-medium flex-1">{selectedContactName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactId("");
                    setSelectedContactName("");
                    setContactSearch("");
                    setShowContactResults(false);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
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
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="What needs to happen?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                if (isControlled) onExternalOpenChange?.(false);
                else setUncontrolledOpen(false);
              }}
            >
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

