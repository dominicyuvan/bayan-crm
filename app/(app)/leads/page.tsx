"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads, useTeamMembers } from "@/lib/firestore-provider";
import type { LeadStatus, LeadTemperature } from "@/lib/types";
import { formatOMR } from "@/lib/utils";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight } from "lucide-react";

const STATUSES: Array<LeadStatus | "all"> = [
  "all",
  "New",
  "Contacted",
  "Qualified",
  "Won",
  "Lost",
];
const TEMPS: Array<LeadTemperature | "all"> = ["all", "cold", "warm", "hot"];

function statusBadgeVariant(status: LeadStatus) {
  switch (status) {
    case "New":
      return "default";
    case "Contacted":
      return "secondary";
    case "Qualified":
      return "outline";
    case "Won":
      return "default";
    case "Lost":
      return "destructive";
  }
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
  const selected = React.useMemo(
    () => leads.items.find((l) => l.id === selectedId) ?? null,
    [leads.items, selectedId]
  );

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
      New: "bg-blue-100 text-blue-700",
      Contacted: "bg-amber-100 text-amber-700",
      Qualified: "bg-purple-100 text-purple-700",
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
              <p className="text-sm font-semibold">
                {contact
                  ? `${contact.firstName} ${contact.lastName}`
                  : "Lead"}
              </p>
              <p className="text-xs text-muted-foreground">
                {lead.propertyType ?? "Lead"} · {lead.location ?? "—"}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              statusColors[lead.status] ?? "bg-muted text-foreground"
            }`}
          >
            {lead.status}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-sm font-semibold">
            OMR {valueStr}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                        {c ? `${c.firstName} ${c.lastName}` : "—"}
                      </TableCell>
                      <TableCell>{l.propertyType ?? "—"}</TableCell>
                      <TableCell>{l.location ?? "—"}</TableCell>
                      <TableCell>
                        {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(l.status)}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
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
                    {c ? `${c.firstName} ${c.lastName}` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(l.propertyType ?? "Lead") + (l.location ? ` • ${l.location}` : "")}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant={statusBadgeVariant(l.status)}>{l.status}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {typeof l.valueOmr === "number" ? formatOMR(l.valueOmr) : "—"}
                    </div>
                  </div>
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
    </div>
  );
}

