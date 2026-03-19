"use client";

import * as React from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads, useTeamMembers } from "@/lib/firestore-provider";
import type { LeadStatus, LeadTemperature } from "@/lib/types";
import { fireConfetti, formatOMR } from "@/lib/utils";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { tsToDate } from "@/lib/firestore";
import type { FollowUpItem } from "@/lib/follow-up-engine";
import { QuickFollowUpDialog } from "@/components/follow-up/quick-follow-up-dialog";

const STATUSES: Array<LeadStatus | "all"> = [
  "all",
  "Initial Contact",
  "Send Brochure",
  "Arrange Visit",
  "Won",
  "Lost",
];
const TEMPS: Array<LeadTemperature | "all"> = ["all", "cold", "warm", "hot"];
const LEAD_STATUSES: LeadStatus[] = [
  "Initial Contact",
  "Send Brochure",
  "Arrange Visit",
  "Won",
  "Lost",
];

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "Initial Contact":
      return "default";
    case "Send Brochure":
      return "secondary";
    case "Arrange Visit":
      return "outline";
    case "Won":
      return "default";
    case "Lost":
      return "destructive";
  }
}

function statusBadgeClass(status: LeadStatus) {
  switch (status) {
    case "Initial Contact":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Send Brochure":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "Arrange Visit":
      return "bg-background text-purple-700 border-purple-400";
    case "Won":
      return "bg-green-100 text-green-700 border-green-200";
    case "Lost":
      return "bg-red-100 text-red-700 border-red-200";
  }
}

function getLeadLastContactDate(lead: any) {
  return tsToDate(lead?.lastContactedAt) ?? tsToDate(lead?.lastContactAt);
}

function getColdnessMeta(lead: any) {
  const last = getLeadLastContactDate(lead);
  if (!last) return { dot: "bg-red-500", title: "Never contacted" };
  const days = Math.floor((Date.now() - last.getTime()) / 86400000);
  if (days < 7) return { dot: "bg-green-500", title: "Active (0-7 days)" };
  if (days < 14) return { dot: "bg-amber-500", title: "Warm (7-14 days)" };
  if (days < 30) return { dot: "bg-orange-500", title: "Cooling (14-30 days)" };
  return { dot: "bg-red-500", title: "Going cold (30+ days)" };
}

export default function LeadsPage() {
  const { profile } = useAuth();
  const leads = useLeads();
  const contacts = useContacts();
  const team = useTeamMembers();
  const role = profile?.role ?? "agent";
  const isAdmin = role === "admin";
  const isManager = role === "manager" || isAdmin;

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<typeof STATUSES[number]>("all");
  const [temp, setTemp] = React.useState<typeof TEMPS[number]>("all");
  const [rep, setRep] = React.useState<string>("all");
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mobileStatusLeadId, setMobileStatusLeadId] = React.useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [quickFollowUpItem, setQuickFollowUpItem] = React.useState<FollowUpItem | null>(null);
  const [showQuickLog, setShowQuickLog] = React.useState(false);
  const selected = React.useMemo(
    () => leads.items.find((l) => l.id === selectedId) ?? null,
    [leads.items, selectedId]
  );

  async function updateLeadStatus(lead: (typeof leads.items)[number], next: LeadStatus) {
    if (!lead.id) return;
    const normalized = next.toLowerCase();
    try {
      await updateDoc(doc(db, "leads", lead.id), {
        status: next,
        updatedAt: serverTimestamp(),
        ...(normalized === "won" || normalized === "lost"
          ? { closedAt: serverTimestamp() }
          : { closedAt: null }),
      });

      if (normalized === "won") {
        await fireConfetti();
        const value = lead.value ?? lead.valueOmr ?? 0;
        const contactName =
          lead.contactName ||
          (contacts.items.find((c) => c.id === lead.contactId)
            ? `${contacts.items.find((c) => c.id === lead.contactId)?.firstName ?? ""} ${
                contacts.items.find((c) => c.id === lead.contactId)?.lastName ?? ""
              }`.trim()
            : "Deal");
        toast.success(`🎉 Deal Won! ${contactName}`, {
          description:
            value > 0
              ? `OMR ${value.toLocaleString("en-US", { minimumFractionDigits: 3 })} closed!`
              : "Congratulations on closing the deal!",
          duration: 6000,
        });
      } else if (normalized === "lost") {
        toast.info("Lead marked as lost", {
          description: "You can re-engage this contact later",
          duration: 3000,
        });
      } else {
        toast.success(`Lead marked as ${next}`);
      }
    } catch (err) {
      console.error("Error updating lead status:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update lead");
    }
  }

  function handleQuickFollowUpFromLead(lead: (typeof leads.items)[number]) {
    const c = contacts.items.find((cc) => cc.id === lead.contactId);
    const last = getLeadLastContactDate(lead);
    const daysSince = last
      ? Math.floor((Date.now() - last.getTime()) / 86400000)
      : null;
    const item: FollowUpItem = {
      leadId: lead.id || "",
      contactId: lead.contactId || "",
      contactName:
        (lead as any).contactName ||
        (c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown contact"),
      contactPhone: (lead as any).contactPhone || c?.phone || c?.whatsapp || "",
      company: (lead as any).company || c?.company || "",
      propertyType: lead.propertyType || "Lead",
      daysSinceContact: daysSince,
      urgency: daysSince && daysSince > 21 ? "overdue" : daysSince && daysSince > 14 ? "today" : "soon",
      reason: daysSince ? `${daysSince} days since last contact` : "Never contacted",
      leadStatus: lead.status,
      leadValue: (lead as any).value || lead.valueOmr || 0,
    };
    setQuickFollowUpItem(item);
    setShowQuickLog(true);
  }

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return leads.items.filter((l) => {
      const ownerUid = l.assignedToUid ?? l.assignedRepId ?? "";
      if (role === "agent" && ownerUid !== profile?.uid) return false;
      const c = contacts.items.find((cc) => cc.id === l.contactId);
      const contactName = c ? `${c.firstName} ${c.lastName}`.toLowerCase() : "";
      const pt = (l.propertyType ?? "").toLowerCase();
      const loc = (l.location ?? "").toLowerCase();
      const matchesQ =
        !query ||
        contactName.includes(query) ||
        pt.includes(query) ||
        loc.includes(query);
      const matchesStatus = status === "all" || l.status === status;
      const matchesTemp = temp === "all" || l.temperature === temp;
      const matchesRep = rep === "all" || ownerUid === rep;
      return matchesQ && matchesStatus && matchesTemp && matchesRep;
    });
  }, [leads.items, contacts.items, q, status, temp, rep, role, profile?.uid]);

  const generatedUncontactedCount = React.useMemo(() => {
    return filtered.filter((l: any) => l.generatedAt && !getLeadLastContactDate(l)).length;
  }, [filtered]);

  React.useEffect(() => {
    try {
      setBannerDismissed(
        window.sessionStorage.getItem("bayan_generated_banner_dismissed") === "true"
      );
    } catch {
      // ignore
    }
  }, []);

  function MobileLeadCard({
    lead,
    onClick,
  }: {
    lead: (typeof leads.items)[number];
    onClick: (l: (typeof leads.items)[number]) => void;
  }) {
    const tempColors: Record<string, string> = {
      hot: "bg-red-500",
      warm: "bg-amber-400",
      cold: "bg-slate-400",
    };
    const statusColors: Record<string, string> = {
      "Initial Contact": "bg-blue-100 text-blue-700",
      "Send Brochure": "bg-amber-100 text-amber-700",
      "Arrange Visit": "bg-purple-100 text-purple-700",
      Won: "bg-green-100 text-green-700",
      Lost: "bg-red-100 text-red-700",
    };
    const contact = contacts.items.find((c) => c.id === lead.contactId);
    const valueStr =
      typeof lead.valueOmr === "number" ? lead.valueOmr.toFixed(3) : "0.000";
    return (
      <div
        onClick={() => onClick(lead)}
        className="cursor-pointer rounded-xl border border-border bg-card p-4 active:bg-muted"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`mt-1.5 h-2 w-2 rounded-full ${
                tempColors[lead.temperature ?? "cold"]
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">
                  {contact ? `${contact.firstName} ${contact.lastName}` : "Lead"}
                </p>
                {(lead as any).generatedAt ? (
                  <Badge
                    variant="outline"
                    className="border-purple-200 bg-purple-50 text-[10px] text-purple-600"
                  >
                    ✨ Generated
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {lead.propertyType ?? "Lead"} · {lead.location ?? "—"}
              </p>
            </div>
          </div>
          <Popover
            open={mobileStatusLeadId === lead.id}
            onOpenChange={(o) => setMobileStatusLeadId(o ? lead.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileStatusLeadId(lead.id ?? null);
                }}
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  statusColors[lead.status] ?? "bg-muted text-foreground"
                }`}
              >
                {lead.status}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              <div className="grid gap-1">
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (!lead.id) return;
                      void updateLeadStatus(lead, s);
                      setMobileStatusLeadId(null);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span
            title={getColdnessMeta(lead).title}
            className={`inline-block h-2.5 w-2.5 rounded-full ${getColdnessMeta(lead).dot}`}
          />
          <span className="font-mono text-sm font-semibold">
            OMR {valueStr}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!bannerDismissed && generatedUncontactedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm text-amber-800">
            You have {generatedUncontactedCount} new generated leads waiting — start reaching out!
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBannerDismissed(true);
              try {
                window.sessionStorage.setItem("bayan_generated_banner_dismissed", "true");
              } catch {
                // ignore
              }
            }}
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Leads</div>
          <div className="text-sm text-muted-foreground">
            Track pipeline, cadences, and outcomes.
          </div>
        </div>
        <AddLeadModal />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by contact, property type, location..."
          className="sm:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => setStatus(v as typeof STATUSES[number])}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={temp}
          onValueChange={(v) => setTemp(v as typeof TEMPS[number])}
        >
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Temperature" />
          </SelectTrigger>
          <SelectContent>
            {TEMPS.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All temps" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isManager && (
          <div className="w-full sm:w-auto">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                size="sm"
                variant={rep === "all" ? "default" : "outline"}
                onClick={() => setRep("all")}
              >
                All reps
              </Button>
              {team.items.map((m) => {
                const repUid = m.id ?? m.uid ?? m.email;
                if (!repUid) return null;
                return (
                  <Button
                    key={repUid}
                    size="sm"
                    variant={rep === repUid ? "default" : "outline"}
                    onClick={() => setRep(repUid)}
                  >
                    {m.name}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        <div className="sm:ml-auto">
          <Button
            variant="outline"
            onClick={() => (setQ(""), setStatus("all"), setTemp("all"), setRep("all"))}
          >
            Clear
          </Button>
        </div>
      </div>

      {leads.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isMobile ? (
        <div className="grid gap-3">
          {filtered.map((l) => (
            <MobileLeadCard
              key={l.id}
              lead={l}
              onClick={(lead) => setSelectedId(lead.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No leads found.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="hidden rounded-xl border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Property Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const c = contacts.items.find((cc) => cc.id === l.contactId);
                  return (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(l.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span>{c ? `${c.firstName} ${c.lastName}` : "—"}</span>
                          {(l as any).generatedAt ? (
                            <Badge
                              variant="outline"
                              className="border-purple-200 bg-purple-50 text-[10px] text-purple-600"
                            >
                              ✨ Generated
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{l.propertyType ?? "—"}</TableCell>
                      <TableCell>{l.location ?? "—"}</TableCell>
                      <TableCell>
                        {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            title={getColdnessMeta(l).title}
                            className={`inline-block h-2.5 w-2.5 rounded-full ${getColdnessMeta(l).dot}`}
                          />
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Badge
                                variant={statusBadgeVariant(l.status)}
                                className={statusBadgeClass(l.status)}
                              >
                                {l.status}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {LEAD_STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onSelect={(ev) => {
                                  ev.preventDefault();
                                  ev.stopPropagation();
                                  if (!l.id) return;
                                  void updateLeadStatus(l, s);
                                }}
                              >
                                {s}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickFollowUpFromLead(l);
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Follow Up
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(l.id);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No leads found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 sm:hidden">
            {filtered.map((l) => {
              const c = contacts.items.find((cc) => cc.id === l.contactId);
              return (
                <button
                  key={l.id}
                  className="rounded-xl border bg-card p-4 text-left"
                  onClick={() => setSelectedId(l.id)}
                >
                  <div className="text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{c ? `${c.firstName} ${c.lastName}` : "—"}</span>
                      {(l as any).generatedAt ? (
                        <Badge
                          variant="outline"
                          className="border-purple-200 bg-purple-50 text-[10px] text-purple-600"
                        >
                          ✨ Generated
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(l.propertyType ?? "Lead") + (l.location ? ` • ${l.location}` : "")}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Popover
                      open={mobileStatusLeadId === l.id}
                      onOpenChange={(o) =>
                        setMobileStatusLeadId(o ? l.id : null)
                      }
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileStatusLeadId(l.id ?? null);
                          }}
                        >
                          <Badge
                            variant={statusBadgeVariant(l.status)}
                            className={statusBadgeClass(l.status)}
                          >
                            {l.status}
                          </Badge>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-44 p-1">
                        <div className="grid gap-1">
                          {LEAD_STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="rounded-md px-2 py-1 text-left text-xs hover:bg-muted"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (!l.id) return;
                                void updateLeadStatus(l, s);
                                setMobileStatusLeadId(null);
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div className="text-xs text-muted-foreground">
                      <span
                        title={getColdnessMeta(l).title}
                        className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${getColdnessMeta(l).dot}`}
                      />
                      {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickFollowUpFromLead(l);
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Follow Up
                  </Button>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                No leads found.
              </div>
            )}
          </div>
        </>
      )}

      <LeadDetailDrawer
        lead={selected}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
      <QuickFollowUpDialog
        open={showQuickLog}
        onOpenChange={setShowQuickLog}
        item={quickFollowUpItem}
        userProfile={profile ? { uid: profile.uid, displayName: profile.displayName } : null}
      />
    </div>
  );
}

