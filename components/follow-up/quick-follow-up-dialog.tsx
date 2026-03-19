"use client";

import * as React from "react";
import { addDays } from "date-fns";
import {
  Timestamp,
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firestore";
import type { FollowUpItem } from "@/lib/follow-up-engine";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const SNOOZE_OPTIONS = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "1 month", days: 30 },
] as const;

type ActivityChoice = "Follow Up" | "Call" | "Meeting" | "Site Visit";

export function QuickFollowUpDialog({
  open,
  onOpenChange,
  item,
  userProfile,
  onBeforeSubmit,
  onErrorRevert,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FollowUpItem | null;
  userProfile: { uid: string; displayName?: string } | null;
  onBeforeSubmit?: (item: FollowUpItem) => void;
  onErrorRevert?: (item: FollowUpItem) => void;
  onSuccess?: (item: FollowUpItem) => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [activityType, setActivityType] = React.useState<ActivityChoice>("Follow Up");
  const [notes, setNotes] = React.useState("");
  const [snoozeDays, setSnoozeDays] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!open) {
      setActivityType("Follow Up");
      setNotes("");
      setSnoozeDays(null);
    }
  }, [open]);

  async function createSnoozeTask(target: FollowUpItem, days: number) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    dueDate.setHours(9, 0, 0, 0);

    await addDoc(collection(db, "tasks"), {
      type: "Follow Up",
      title: `Follow up — ${target.contactName}`,
      notes: "",
      contactId: target.contactId || null,
      contactName: target.contactName || "",
      leadId: target.leadId || null,
      assignedTo: userProfile?.displayName || "",
      assignedToUid: userProfile?.uid || "",
      assignedToId: userProfile?.uid || "",
      dueAt: Timestamp.fromDate(dueDate),
      status: "pending",
      outcome: null,
      completedAt: null,
      createdBy: userProfile?.uid || "",
      createdByName: userProfile?.displayName || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function onSubmit() {
    if (!item || !userProfile?.uid) return;
    onBeforeSubmit?.(item);
    setSubmitting(true);
    try {
      await addDoc(collection(db, "activities"), {
        type: activityType,
        notes: notes.trim() || "",
        contactId: item.contactId || null,
        contactName: item.contactName || null,
        leadId: item.leadId || null,
        outcome: null,
        createdBy: userProfile.uid,
        createdByName: userProfile.displayName || "",
        createdAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        dueAt: null,
        status: "done",
      });

      await updateDoc(doc(db, "leads", item.leadId), {
        lastContactedAt: serverTimestamp(),
        lastContactAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (snoozeDays) {
        await createSnoozeTask(item, snoozeDays);
      }

      toast.success("Follow up logged ✓");
      onSuccess?.(item);
      onOpenChange(false);
    } catch (err) {
      onErrorRevert?.(item);
      toast.error(
        err instanceof Error ? err.message : "Failed to log follow up"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const previewDate = React.useMemo(() => {
    if (!snoozeDays) return null;
    return addDays(new Date(), snoozeDays);
  }, [snoozeDays]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Log follow up — {item?.contactName || "Contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["Follow Up", "Call", "Meeting", "Site Visit"] as ActivityChoice[]).map(
              (option) => (
                <Button
                  key={option}
                  type="button"
                  variant={activityType === option ? "default" : "outline"}
                  onClick={() => setActivityType(option)}
                  className="h-8 text-xs"
                >
                  {option}
                </Button>
              )
            )}
          </div>

          <Textarea
            rows={3}
            placeholder="What happened?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Remind me again in...</div>
            <div className="grid grid-cols-2 gap-2">
              {SNOOZE_OPTIONS.map((o) => (
                <Button
                  key={o.days}
                  type="button"
                  variant={snoozeDays === o.days ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setSnoozeDays(o.days)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            {previewDate ? (
              <div className="text-xs text-muted-foreground">
                Snooze task due {previewDate.toLocaleDateString()}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} disabled={submitting}>
              {submitting ? "Saving..." : "Log & Done"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
