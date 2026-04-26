"use client";

import * as React from "react";
import {
  Timestamp,
  collection,
  deleteDoc,
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
import type { Activity, Lead, LeadStatus } from "@/lib/types";
import { fireConfetti, formatOMR, whatsappLink } from "@/lib/utils";
import { tsToDate } from "@/lib/firestore";
import { useContacts } from "@/lib/firestore-provider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { useLogActivityControl } from "@/lib/log-activity-control-context";
import { AddTaskModal } from "@/components/tasks/add-task-modal";
import {
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react";
import { canManageEntity, getRecordOwnerUid } from "@/lib/permissions";

const STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "initial_contact",
  "arrange_visit",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
  "on_hold",
];

function statusBadgeClass(status: LeadStatus) {
  switch (status) {
    case "new":
    case "initial_contact":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "contacted":
    case "arrange_visit":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "qualified":
    case "proposal_sent":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "negotiation":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "won":
      return "bg-green-100 text-green-700 border-green-200";
    case "lost":
      return "bg-red-100 text-red-700 border-red-200";
    case "on_hold":
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "new":
    case "initial_contact":
      return "default";
    case "contacted":
    case "arrange_visit":
      return "secondary";
    case "qualified":
    case "proposal_sent":
    case "negotiation":
    case "on_hold":
      return "outline";
    case "won":
      return "default";
    case "lost":
      return "destructive";
  }
}

function statusLabel(status: LeadStatus) {
  const labels: Record<LeadStatus, string> = {
    new: "New",
    contacted: "Contacted",
    qualified: "Qualified",
    initial_contact: "Initial Contact",
    arrange_visit: "Arrange Visit",
    proposal_sent: "Proposal Sent",
    negotiation: "Negotiation",
    won: "Won",
    lost: "Lost",
    on_hold: "On Hold",
  };
  return labels[status] ?? status;
}

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
  const { profile } = useAuth();
  const { setOpen: setLogActivityOpen, setPreselectedLeadId, setPreselectedContactId } = useLogActivityControl();

  const [saving, setSaving] = React.useState(false);
  const [propertyType, setPropertyType] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [valueOmr, setValueOmr] = React.useState<string>("");
  const [unitSize, setUnitSize] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [status, setStatus] = React.useState<LeadStatus>("initial_contact");
  const [notes, setNotes] = React.useState("");

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [deletingLead, setDeletingLead] = React.useState(false);
  const [deletingActivityId, setDeletingActivityId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!lead) return;
    setPropertyType(lead.propertyType ?? "");
    setLocation(lead.location ?? "");
    setValueOmr(
      typeof lead.valueOmr === "number" && Number.isFinite(lead.valueOmr)
        ? lead.valueOmr.toFixed(3)
        : ""
    );
    setUnitSize(lead.unitSize ?? "");
    setBudgetMin(typeof lead.budgetMin === "number" ? String(lead.budgetMin) : "");
    setBudgetMax(typeof lead.budgetMax === "number" ? String(lead.budgetMax) : "");
    setStatus(lead.status);
    setNotes(lead.notes ?? "");
  }, [lead]);

  const contact = React.useMemo(() => {
    if (!lead) return null;
    return contacts.items.find((c) => c.id === lead.contactId) ?? null;
  }, [contacts.items, lead]);

  const [activityItems, setActivityItems] = React.useState<
    Array<Activity & { id: string }>
  >([]);

  const lastActivityDate = React.useMemo(() => {
    if (!lead) return null;
    if (activityItems.length > 0) {
      const latest = activityItems.reduce((max, a) => {
        const t = a.createdAt.toMillis();
        return t > max ? t : max;
      }, 0);
      return latest ? new Date(latest) : null;
    }
    return tsToDate(lead.lastContactAt ?? lead.createdAt) ?? null;
  }, [activityItems, lead]);

  const isStepOverdue = React.useMemo(() => {
    if (!lastActivityDate) return false;
    return Date.now() - lastActivityDate.getTime() > 24 * 60 * 60 * 1000;
  }, [lastActivityDate]);

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
    if (!open || !lead?.id) return;

    const clauses: Parameters<typeof query>[1][] = [
      where("contactId", "==", lead.contactId),
    ];

    if (profile?.role === "agent") {
      clauses.push(where("createdBy", "==", profile.uid));
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
  }, [open, lead?.id, profile?.role, profile?.uid]);

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
        propertyType,
        location,
        value: parseFloat(budgetMax) || parseFloat(budgetMin) || lead.value || 0,
        valueOmr: parsed,
        status,
        notes,
        ...(unitSize ? { unitSize } : {}),
        ...(budgetMin ? { budgetMin: parseFloat(budgetMin) } : {}),
        ...(budgetMax ? { budgetMax: parseFloat(budgetMax) } : {}),
        updatedAt: serverTimestamp() as unknown as Timestamp,
        ...(status.toLowerCase() === "won" || status.toLowerCase() === "lost"
          ? { closedAt: serverTimestamp() }
          : { closedAt: null }),
      });
      if (status.toLowerCase() === "won") {
        await fireConfetti();
        const value = parsed ?? lead.value ?? lead.valueOmr ?? 0;
        const contactName = contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : lead.contactName || "Deal";
        toast.success(`🎉 Deal Won! ${contactName}`, {
          description:
            value > 0
              ? `OMR ${value.toLocaleString("en-US", { minimumFractionDigits: 3 })} closed!`
              : "Congratulations on closing the deal!",
          duration: 6000,
        });
      } else if (status.toLowerCase() === "lost") {
        toast.info("Lead marked as lost", {
          description: "You can re-engage this contact later",
          duration: 3000,
        });
      } else {
        toast.success("Lead updated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const canDeleteLead = canManageEntity({
    role: profile?.role,
    entity: "leads",
    action: "delete",
    ownerUid: getRecordOwnerUid(lead ?? {}),
    profileUid: profile?.uid,
  });

  async function onDeleteLead() {
    if (!lead?.id) return;
    if (!canDeleteLead) {
      toast.error("You can only delete leads you created");
      return;
    }
    const ok = window.confirm("Delete this lead? This cannot be undone.");
    if (!ok) return;

    setDeletingLead(true);
    try {
      await deleteDoc(doc(db, "leads", lead.id));
      toast.success("Lead deleted");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingLead(false);
    }
  }

  async function onDeleteActivity(activity: Activity & { id: string }) {
    const canDeleteActivity = canManageEntity({
      role: profile?.role,
      entity: "activities",
      action: "delete",
      ownerUid: getRecordOwnerUid(activity),
      profileUid: profile?.uid,
    });
    if (!canDeleteActivity) {
      toast.error("You can only delete activities you created");
      return;
    }
    const ok = window.confirm("Delete this activity?");
    if (!ok) return;

    setDeletingActivityId(activity.id);
    try {
      await deleteDoc(doc(db, "activities", activity.id));
      toast.success("Activity deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingActivityId(null);
    }
  }

  const isInitialContact = status === "new" || status === "initial_contact";
  const isArrangeVisit = status === "qualified" || status === "arrange_visit";
  const isProposal = status === "contacted" || status === "proposal_sent";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Lead</SheetTitle>
        </SheetHeader>

        {!lead ? null : (
          <div className="space-y-6 px-4 pb-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Suggested Next Action</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Based on the current stage
                  </div>
                </div>
                <Badge
                  variant={statusBadgeVariant(status)}
                  className={statusBadgeClass(status)}
                >
                  {statusLabel(status)}
                </Badge>
              </div>

              <div className="mt-3 space-y-2">
                {isInitialContact ? (
                  <Button
                    className={`w-full justify-center ${isStepOverdue ? "animate-pulse" : ""}`}
                    onClick={() => {
                      if (!lead.id) return;
                      setPreselectedLeadId(lead.id);
                      setPreselectedContactId(contact?.id ?? null);
                      setLogActivityOpen(true);
                    }}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Lead
                  </Button>
                ) : null}

                {isProposal ? (
                  <Button
                    variant="secondary"
                    className={`w-full justify-center ${isStepOverdue ? "animate-pulse" : ""}`}
                    asChild
                  >
                    <a
                      href={
                        contact?.whatsapp
                          ? whatsappLink(contact.whatsapp)
                          : contact?.phone
                            ? whatsappLink(contact.phone)
                            : "#"
                      }
                      onClick={(e) => {
                        if (!contact?.whatsapp && !contact?.phone) {
                          e.preventDefault();
                          toast.error("No phone/WhatsApp number found for this contact");
                        }
                      }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Share Brochure via WhatsApp
                    </a>
                  </Button>
                ) : null}

                {isArrangeVisit ? (
                  <Button
                    variant="outline"
                    className={`w-full justify-center ${isStepOverdue ? "animate-pulse" : ""}`}
                    onClick={() => {
                      if (!lead.id) return;
                      setScheduleOpen(true);
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Schedule Site Visit
                  </Button>
                ) : null}

                {status === "won" ? (
                  <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                    Deal closed as won. Nice work.
                  </div>
                ) : null}

                {status === "lost" ? (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    Deal marked lost. Log the final note in Tasks.
                  </div>
                ) : null}
              </div>

              {isArrangeVisit ? (
                <div className="mt-3">
                  <AddTaskModal
                    externalOpen={scheduleOpen}
                    onExternalOpenChange={setScheduleOpen}
                    prefill={{
                      type: "site_visit",
                      title: "Site Visit",
                      contactId: contact?.id ?? "",
                      leadId: lead.id ?? "",
                      dueDate: new Date().toISOString().slice(0, 10),
                      dueTime: "10:00",
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="text-sm font-medium">
                {contact ? `${contact.firstName} ${contact.lastName}` : "—"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {contact?.company ?? "—"} • {contact?.phone ?? "—"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={statusBadgeVariant(status)}
                  className={statusBadgeClass(status)}
                >
                  {statusLabel(status)}
                </Badge>
                {typeof lead.valueOmr === "number" && (
                  <Badge variant="outline">{formatOMR(lead.valueOmr)}</Badge>
                )}
              </div>
            </div>

            {lead.budgetMin || lead.budgetMax ? (
              <div>
                <p className="text-xs text-muted-foreground">Budget Range</p>
                <p className="font-mono text-sm">
                  {lead.budgetMin ? `OMR ${lead.budgetMin.toLocaleString()}` : ""}
                  {lead.budgetMin && lead.budgetMax ? " – " : ""}
                  {lead.budgetMax ? `OMR ${lead.budgetMax.toLocaleString()}` : ""}
                </p>
              </div>
            ) : null}

            {lead.unitSize ? (
              <div>
                <p className="text-xs text-muted-foreground">Unit Size</p>
                <p className="text-sm">{lead.unitSize}</p>
              </div>
            ) : null}

            {lead.createdByName ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {lead.createdByName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lead Owner</p>
                  <p className="text-sm font-medium">{lead.createdByName}</p>
                </div>
              </div>
            ) : null}

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
                <Label>Unit Size</Label>
                <Input value={unitSize} onChange={(e) => setUnitSize(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Budget Min (OMR)</Label>
                <Input
                  type="number"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Budget Max (OMR)</Label>
                <Input
                  type="number"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                />
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
                        {statusLabel(s)}
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
              <Button
                variant="destructive"
                onClick={() => void onDeleteLead()}
                disabled={!canDeleteLead || deletingLead}
              >
                {deletingLead ? "Deleting..." : "Delete lead"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Activity timeline</div>
              {activityItems.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No activities yet.
                </div>
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

                    const contactName = contact
                      ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
                      : a.type;

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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void onDeleteActivity(a)}
                          disabled={
                            deletingActivityId === a.id ||
                            !canManageEntity({
                              role: profile?.role,
                              entity: "activities",
                              action: "delete",
                              ownerUid: getRecordOwnerUid(a),
                              profileUid: profile?.uid,
                            })
                          }
                        >
                          {deletingActivityId === a.id ? "..." : "Delete"}
                        </Button>
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

