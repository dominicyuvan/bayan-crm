"use client";

import * as React from "react";
import {
  Timestamp,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import type { Activity, Contact } from "@/lib/types";
import { tsToDate } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import { whatsappLink } from "@/lib/utils";
import { useLeads } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";

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

  const [activityItems, setActivityItems] = React.useState<
    Array<Activity & { id: string }>
  >([]);

  function truncateText(text: string, max = 60) {
    const t = (text ?? "").trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
  }

  function relativeTime(from: Date) {
    const now = new Date();
    const startNow = new Date(now);
    startNow.setHours(0, 0, 0, 0);
    const startFrom = new Date(from);
    startFrom.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (startNow.getTime() - startFrom.getTime()) / 86400000
    );

    if (diffDays === 0) {
      const diffMs = now.getTime() - from.getTime();
      const minutes = Math.max(0, Math.floor(diffMs / 60000));
      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes} min ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }

    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    return from.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  function getActivityVisual(type: string) {
    switch (type) {
      case "call":
      case "Call":
      case "Contact Made":
        return {
          Icon: Phone,
          iconBg: "bg-blue-100",
          iconColor: "text-blue-600",
        };
      case "site_visit":
      case "Site Visit":
      case "site visit":
        return {
          Icon: MapPin,
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
        };
      case "meeting":
      case "Meeting":
        return {
          Icon: Users,
          iconBg: "bg-green-100",
          iconColor: "text-green-600",
        };
      case "note":
      case "Follow Up":
      case "follow_up":
      case "Note":
      case "whatsapp":
        return {
          Icon: MessageSquare,
          iconBg: "bg-amber-100",
          iconColor: "text-amber-600",
        };
      case "email":
      case "Email":
        return {
          Icon: Mail,
          iconBg: "bg-purple-100",
          iconColor: "text-purple-600",
        };
      default:
        return {
          Icon: FileText,
          iconBg: "bg-gray-100",
          iconColor: "text-gray-600",
        };
    }
  }

  React.useEffect(() => {
    if (!open || !contact?.id) return;

    const clauses: Parameters<typeof query>[1][] = [
      where("contactId", "==", contact.id),
    ];

    if (profile?.role === "agent") {
      clauses.push(where("repId", "==", profile.uid));
    }

    clauses.push(orderBy("createdAt", "desc"));
    clauses.push(limit(20));

    const q = query(collection(db, "activities"), ...clauses);
    const unsub = onSnapshot(q, (snap) => {
      setActivityItems(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Activity),
        }))
      );
    });

    return () => unsub();
  }, [open, contact?.id, profile?.role, profile?.uid]);

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
                <div className="text-sm text-muted-foreground">No activities yet.</div>
              ) : (
                <div className="space-y-3">
                  {activityItems.map((a) => {
                    const createdAt =
                      tsToDate(a.createdAt) ?? tsToDate(a.occurredAt);
                    const createdAtDate = createdAt ?? new Date();
                    const { Icon, iconBg, iconColor } = getActivityVisual(a.type);
                    const notes = (a.notes ?? a.title ?? "").toString();

                    const outcome =
                      ((a as unknown as { outcome?: string }).outcome ??
                        "neutral") as string;
                    const outcomeColor =
                      outcome === "positive"
                        ? "bg-green-500"
                        : outcome === "negative"
                        ? "bg-red-500"
                        : "bg-gray-400";

                    const contactName = `${contact?.firstName ?? ""} ${
                      contact?.lastName ?? ""
                    }`.trim();

                    return (
                      <div
                        key={a.id}
                        className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50"
                      >
                        <div className={`p-2 rounded-lg ${iconBg}`}>
                          <Icon className={`h-4 w-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {contactName || a.type}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {relativeTime(createdAtDate)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {truncateText(notes)}
                          </p>
                        </div>
                        <div
                          className={`h-2 w-2 rounded-full mt-2 ${outcomeColor}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

