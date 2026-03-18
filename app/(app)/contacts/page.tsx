"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useTeamMembers } from "@/lib/firestore-provider";
import { tsToDate } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { AddContactModal } from "@/components/contacts/add-contact-modal";
import { ContactDetailDrawer } from "@/components/contacts/contact-detail-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ContactsPage() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const team = useTeamMembers();
  const isManager = profile?.role === "manager";

  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState<string>("all");
  const [rep, setRep] = React.useState<string>("all");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selected = React.useMemo(() => {
    return contacts.items.find((c) => c.id === selectedId) ?? null;
  }, [contacts.items, selectedId]);

  const sources = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts.items) if (c.source) set.add(c.source);
    return Array.from(set).sort();
  }, [contacts.items]);

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return contacts.items.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      const company = (c.company ?? "").toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      const matchesQ =
        !query || name.includes(query) || company.includes(query) || phone.includes(query);
      const matchesSource = source === "all" || c.source === source;
      const matchesRep = rep === "all" || c.assignedRepId === rep;
      return matchesQ && matchesSource && matchesRep;
    });
  }, [contacts.items, q, source, rep]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Contacts</div>
          <div className="text-sm text-muted-foreground">
            Search, segment, and track your relationships.
          </div>
        </div>
        <AddContactModal />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, company, phone..."
          className="sm:max-w-sm"
        />
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isManager && (
          <Select value={rep} onValueChange={setRep}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Rep" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reps</SelectItem>
              {team.items.map((m) => (
                <SelectItem key={m.id} value={m.uid}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="sm:ml-auto">
          <Button variant="outline" onClick={() => (setQ(""), setSource("all"), setRep("all"))}>
            Clear
          </Button>
        </div>
      </div>

      {contacts.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden rounded-xl border bg-card sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <TableCell className="font-medium">
                      {c.firstName} {c.lastName}
                    </TableCell>
                    <TableCell>{c.company ?? "—"}</TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell>{c.source ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(c.tags ?? []).slice(0, 2).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tsToDate(c.lastContactAt)?.toLocaleDateString() ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(c.id);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      No contacts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 sm:hidden">
            {filtered.map((c) => (
              <button
                key={c.id}
                className={cn("rounded-xl border bg-card p-4 text-left")}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="text-sm font-semibold">
                  {c.firstName} {c.lastName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.company ?? "—"} • {c.phone}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Last contact: {tsToDate(c.lastContactAt)?.toLocaleDateString() ?? "—"}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                No contacts found.
              </div>
            )}
          </div>
        </>
      )}

      <ContactDetailDrawer
        contact={selected}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}

