"use client";

import * as React from "react";
import { Timestamp, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import type { Contact } from "@/lib/types";
import { tsToDate } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import { whatsappLink } from "@/lib/utils";
import { useActivities, useLeads } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function ContactDetailDrawer({
  contact,
  open,
  onOpenChange,
}: {
  contact: (Contact & { id: string }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { profile } = useAuth();
  const activities = useActivities();
  const leads = useLeads();

  const [saving, setSaving] = React.useState(false);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");

  React.useEffect(() => {
    if (!contact) return;
    setFirstName(contact.firstName ?? "");
    setLastName(contact.lastName ?? "");
    setPhone(contact.phone ?? "");
    setCompany(contact.company ?? "");
  }, [contact]);

  const activityItems = React.useMemo(() => {
    if (!contact) return [];
    return activities.items
      .filter((a) => {
        if (a.contactId !== contact.id) return false;
        if (profile?.role === "agent" && a.repId !== profile.uid) return false;
        return true;
      })
      .slice(0, 30);
  }, [activities.items, contact, profile?.role, profile?.uid]);

  const linkedLeads = React.useMemo(() => {
    if (!contact) return [];
    return leads.items.filter((l) => l.contactId === contact.id).slice(0, 10);
  }, [leads.items, contact]);

  async function onSaveInline() {
    if (!contact) return;
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "contacts", contact.id), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        company: company.trim() || null,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      });
      toast.success("Contact updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const name =
    contact ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{name || "Contact"}</SheetTitle>
        </SheetHeader>

        {!contact ? null : (
          <div className="space-y-6 px-4 pb-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Company</Label>
                <Input value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSaveInline} disabled={saving}>
                Save changes
              </Button>
              <Button
                variant="outline"
                asChild
                disabled={!contact.whatsapp && !contact.phone}
              >
                <a
                  href={whatsappLink(contact.whatsapp || contact.phone)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Linked leads</div>
              {linkedLeads.length === 0 ? (
                <div className="text-sm text-muted-foreground">No leads yet.</div>
              ) : (
                <div className="space-y-2">
                  {linkedLeads.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {l.propertyType ?? "Lead"}{" "}
                          {l.location ? `• ${l.location}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last contact:{" "}
                          {tsToDate(l.lastContactAt)?.toLocaleDateString() ?? "—"}
                        </div>
                      </div>
                      <Badge variant="secondary">{l.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
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

