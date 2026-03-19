"use client";

import * as React from "react";
import { doc, setDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import {
  FileText,
  MapPin,
  Phone,
  Users,
  Zap,
  X,
} from "lucide-react";

import { activitiesCol } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads } from "@/lib/firestore-provider";
import type { Activity } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type LogActivityFabProps = {
  preselectedContactId?: string;
  preselectedLeadId?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
};

type ActivityTypeChoice = "Call" | "Note" | "Site Visit" | "Meeting";

const TYPE_DEFS: Record<
  ActivityTypeChoice,
  {
    label: ActivityTypeChoice;
    Icon: React.ComponentType<{ className?: string }>;
    selectedClasses: string;
    placeholder: string;
  }
> = {
  Call: {
    label: "Call",
    Icon: Phone,
    selectedClasses: "border-rose-400 bg-rose-50 text-rose-500",
    placeholder: "What happened on this call?",
  },
  Note: {
    label: "Note",
    Icon: FileText,
    selectedClasses: "border-blue-400 bg-blue-50 text-blue-500",
    placeholder: "Add a note...",
  },
  "Site Visit": {
    label: "Site Visit",
    Icon: MapPin,
    selectedClasses: "border-green-400 bg-green-50 text-green-500",
    placeholder: "How did the site visit go?",
  },
  Meeting: {
    label: "Meeting",
    Icon: Users,
    selectedClasses: "border-amber-400 bg-amber-50 text-amber-500",
    placeholder: "What was discussed?",
  },
};

function getSuccessToastTitle(type: ActivityTypeChoice) {
  switch (type) {
    case "Call":
      return "Call logged ✓";
    case "Note":
      return "Note added ✓";
    case "Site Visit":
      return "Site Visit logged ✓";
    case "Meeting":
      return "Meeting logged ✓";
  }
}

export function LogActivityFab({
  preselectedContactId,
  preselectedLeadId,
  externalOpen,
  onExternalOpenChange,
}: LogActivityFabProps) {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const contacts = useContacts();
  const leads = useLeads();

  const contactById = React.useMemo(() => {
    const map = new Map<string, (typeof contacts.items)[number]>();
    for (const c of contacts.items) {
      if (c.id) map.set(c.id, c);
    }
    return map;
  }, [contacts.items]);

  const derivedContactIdFromLead = React.useMemo(() => {
    if (!preselectedLeadId) return null;
    const lead = leads.items.find((l) => l.id === preselectedLeadId) ?? null;
    return lead?.contactId ?? null;
  }, [leads.items, preselectedLeadId]);

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled =
    typeof externalOpen === "boolean" && typeof onExternalOpenChange === "function";
  const open = isControlled ? externalOpen : uncontrolledOpen;

  const close = React.useCallback(() => {
    onExternalOpenChange?.(false);
    if (!isControlled) setUncontrolledOpen(false);
    setTypeGridShaking(false);
    setTypeError(null);
    setNotesHint(null);
    setNotes("");
    setLinkExpanded(false);
  }, [isControlled, onExternalOpenChange]);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) {
        onExternalOpenChange?.(next);
        return;
      }
      setUncontrolledOpen(next);
    },
    [isControlled, onExternalOpenChange]
  );

  const [selectedType, setSelectedType] = React.useState<ActivityTypeChoice | null>(null);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [typeError, setTypeError] = React.useState<string | null>(null);
  const [notesHint, setNotesHint] = React.useState<string | null>(null);

  const [typeGridShaking, setTypeGridShaking] = React.useState(false);

  const [linkExpanded, setLinkExpanded] = React.useState(false);
  const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);

  const selectedContactName = React.useMemo(() => {
    if (!selectedContactId) return null;
    const c = contactById.get(selectedContactId);
    if (!c) return null;
    const full = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
    return full || null;
  }, [contactById, selectedContactId]);

  // Initialize linked contact from props when the panel opens.
  React.useEffect(() => {
    if (!open) return;
    const nextContactId = preselectedContactId ?? derivedContactIdFromLead ?? null;
    setSelectedContactId(nextContactId);
  }, [open, preselectedContactId, derivedContactIdFromLead]);

  const closeTimerRef = React.useRef<number | null>(null);
  const shakeTimerRef = React.useRef<number | null>(null);

  const shakeTypeGrid = React.useCallback(() => {
    setTypeError("Select an activity type");
    setTypeGridShaking(true);
    if (shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = window.setTimeout(() => setTypeGridShaking(false), 340);
  }, []);

  const notesPlaceholder = React.useMemo(() => {
    if (!selectedType) return "Add notes...";
    return TYPE_DEFS[selectedType]?.placeholder ?? "Add notes...";
  }, [selectedType]);

  const selectedNotesIsEmpty = notes.trim().length === 0;

  async function submit() {
    if (!profile?.uid) return;
    if (submitting) return;

    if (!selectedType) {
      shakeTypeGrid();
      return;
    }

    if (selectedNotesIsEmpty && selectedType !== "Call") {
      setNotesHint("Add a quick note");
    }

    setSubmitting(true);
    try {
      const payload = {
        type: selectedType,
        notes: notes.trim(),
        contactId: selectedContactId || null,
        contactName: selectedContactName || null,
        leadId: null,
        outcome: null,
        createdBy: profile.uid,
        createdByName: profile.displayName || "",
        createdAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        dueAt: null,
        status: "done",
      } satisfies WithFieldValue<Activity>;

      const ref = doc(activitiesCol);
      await setDoc(ref, payload);

      toast.success(getSuccessToastTitle(selectedType));
      setNotes("");
      setNotesHint(null);
      setLinkExpanded(false);

      // Keep the panel open briefly for feedback.
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = window.setTimeout(() => {
        setOpen(false);
      }, 1000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save activity");
    } finally {
      setSubmitting(false);
    }
  }

  // Keyboard shortcuts: Cmd/Ctrl+Enter to submit; Escape to close.
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === "Enter") {
        e.preventDefault();
        void submit();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, selectedType, notes, submitting, selectedContactId, selectedContactName, profile?.uid]);

  // Desktop close timer cleanup.
  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const panel = (
    <div
      className={cn(
        "w-[320px] rounded-2xl shadow-2xl overflow-hidden",
        "bg-background border border-border"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-primary px-4 py-3 text-white flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <Zap className="h-5 w-5" />
          <span>Log Activity</span>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
            close();
          }}
          className="text-white hover:opacity-90"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div
          className={cn(
            "grid grid-cols-2 gap-2",
            typeGridShaking ? "bayan-shake" : ""
          )}
        >
          {(Object.keys(TYPE_DEFS) as ActivityTypeChoice[]).map((t) => {
            const def = TYPE_DEFS[t];
            const selected = selectedType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSelectedType(t);
                  setTypeError(null);
                  setNotesHint(null);
                }}
                className={cn(
                  "rounded-2xl border-2 p-4 min-h-[80px] flex flex-col items-center justify-center",
                  selected
                    ? def.selectedClasses
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                <def.Icon className="h-8 w-8 text-current" />
                <span className="mt-2 text-sm font-medium">{def.label}</span>
              </button>
            );
          })}
        </div>

        {typeError && (
          <div className="text-xs text-destructive">{typeError}</div>
        )}

        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            if (notesHint) setNotesHint(null);
          }}
          placeholder={notesPlaceholder}
          rows={3}
          className="border border-border rounded-xl text-[16px]"
        />

        {notesHint && (
          <div className="text-xs text-muted-foreground">{notesHint}</div>
        )}

        {!linkExpanded ? (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:underline"
            onClick={() => setLinkExpanded(true)}
          >
            + Link to contact
          </button>
        ) : (
          <div>
            <Select
              value={selectedContactId ?? ""}
              onValueChange={(v) => {
                setSelectedContactId(v || null);
                setLinkExpanded(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.items
                  .filter((c) => c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id!}>
                      {c.firstName} {c.lastName} {c.company ? `• ${c.company}` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">Cmd+Enter to save</div>
          <Button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="bg-primary text-white rounded-full px-5 py-2 hover:bg-primary/90"
          >
            {submitting ? "Logging..." : "Log Activity"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={(v) => {
          if (!v && closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
          if (!v && shakeTimerRef.current) window.clearTimeout(shakeTimerRef.current);
          closeTimerRef.current = null;
          shakeTimerRef.current = null;
          setOpen(v);
          if (!v) {
            setNotes("");
            setNotesHint(null);
            setLinkExpanded(false);
            setTypeError(null);
            setTypeGridShaking(false);
          }
        }}
      >
        <DrawerContent className="pb-safe">
          <div className="mx-auto px-4 pb-safe pt-4">{panel}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      {/* Floating trigger button - desktop only */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 hidden md:flex",
          "h-14 w-14 rounded-full bg-zinc-900 shadow-xl",
          "items-center justify-center transition-transform duration-200"
        )}
        aria-label="Log activity"
      >
        {open ? <X className="h-5 w-5 text-white" /> : <Zap className="h-5 w-5 text-white" />}
      </button>

      {/* Floating panel (desktop) */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => {
            if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
            close();
          }}
        >
          <div className="fixed inset-0" />
          <div
            className="fixed bottom-24 right-6"
            onClick={(e) => e.stopPropagation()}
          >
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

