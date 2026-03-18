"use client";

import * as React from "react";
import { Timestamp, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import type { Lead, LeadStatus } from "@/lib/types";
import { formatOMR } from "@/lib/utils";
import { tsToDate } from "@/lib/firestore";
import { useActivities, useContacts } from "@/lib/firestore-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Won", "Lost"];

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
}: {
  lead: (Lead & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contacts = useContacts();
  const activities = useActivities();

  const [saving, setSaving] = React.useState(false);
  const [propertyType, setPropertyType] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [valueOmr, setValueOmr] = React.useState<string>("");
  const [status, setStatus] = React.useState<LeadStatus>("New");

  React.useEffect(() => {
    if (!lead) return;
    setPropertyType(lead.propertyType ?? "");
    setLocation(lead.location ?? "");
    setValueOmr(
      typeof lead.valueOmr === "number" && Number.isFinite(lead.valueOmr)
        ? lead.valueOmr.toFixed(3)
        : ""
    );
    setStatus(lead.status);
  }, [lead]);

  const contact = React.useMemo(() => {
    if (!lead) return null;
    return contacts.items.find((c) => c.id === lead.contactId) ?? null;
  }, [contacts.items, lead]);

  const activityItems = React.useMemo(() => {
    if (!lead) return [];
    return activities.items.filter((a) => a.leadId === lead.id).slice(0, 30);
  }, [activities.items, lead]);

  async function onSave() {
    if (!lead) return;
    setSaving(true);
    try {
      const parsed =
        valueOmr.trim() === "" ? null : Number(valueOmr.replace(/,/g, ""));
      if (parsed !== null && !Number.isFinite(parsed)) {
        toast.error("Value must be a number");
        return;
      }

      await updateDoc(doc(db, "leads", lead.id), {
        propertyType: propertyType.trim() || null,
        location: location.trim() || null,
        valueOmr: parsed,
        status,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Lead updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Lead</SheetTitle>
        </SheetHeader>

        {!lead ? null : (
          <div className="space-y-6 px-4 pb-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-medium">
                {contact ? `${contact.firstName} ${contact.lastName}` : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {contact?.company ?? "—"} • {contact?.phone ?? "—"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{lead.status}</Badge>
                {typeof lead.valueOmr === "number" && (
                  <Badge variant="outline">{formatOMR(lead.valueOmr)}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Property Type</Label>
                <Input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Value (OMR)</Label>
                <Input value={valueOmr} onChange={(e) => setValueOmr(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={onSave} disabled={saving}>
                Save changes
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Activity timeline</div>
              {activityItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No activities logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {activityItems.map((a) => (
                    <div key={a.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{a.title}</div>
                        <div className="shrink-0 text-xs text-muted-foreground">
                          {tsToDate(a.occurredAt)?.toLocaleString() ?? ""}
                        </div>
                      </div>
                      {a.notes && (
                        <div className="mt-1 text-sm text-muted-foreground">
                          {a.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

