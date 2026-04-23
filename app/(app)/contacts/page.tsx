"use client";

import * as React from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useActivities, useContacts } from "@/lib/firestore-provider";
import { tsToDate } from "@/lib/firestore";
import { cn } from "@/lib/utils";
import { AddContactModal } from "@/components/contacts/add-contact-modal";
import { ContactDetailDrawer } from "@/components/contacts/contact-detail-drawer";
import { AddLeadModal } from "@/components/leads/add-lead-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Phone, MessageCircle, ChevronRight } from "lucide-react";
import { SOURCE_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";

function toWaNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

export default function ContactsPage() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const activities = useActivities();
  const role = profile?.role ?? "agent";

  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState<string>("all");
  const [phoneFilter, setPhoneFilter] = React.useState<"all" | "with_phone" | "without_phone">("all");
  const [sortBy, setSortBy] = React.useState<
    "name_asc" | "name_desc" | "last_contact_desc" | "last_contact_asc" | "activity_desc"
  >("last_contact_desc");
  const [viewMode, setViewMode] = React.useState<"classic" | "grid" | "table">("table");
  const isMobile = useIsMobile();

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [addLeadOpen, setAddLeadOpen] = React.useState(false);
  const [preselectedContactId, setPreselectedContactId] = React.useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkSource, setBulkSource] = React.useState<string>("");
  const [bulkSaving, setBulkSaving] = React.useState(false);
  const selected = React.useMemo(() => {
    return contacts.items.find((c) => c.id === selectedId) ?? null;
  }, [contacts.items, selectedId]);

  // Contacts are org-wide (single Firestore collection); all roles see the same list.
  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return contacts.items.filter((c) => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase();
      const company = (c.company ?? "").toLowerCase();
      const phone = (c.phone ?? "").toLowerCase();
      const hasPhone = !!(c.phone ?? c.whatsapp ?? "").trim();
      const matchesQ =
        !query || name.includes(query) || company.includes(query) || phone.includes(query);
      const matchesSource = source === "all" || c.source === source;
      const matchesPhone =
        phoneFilter === "all" ||
        (phoneFilter === "with_phone" && hasPhone) ||
        (phoneFilter === "without_phone" && !hasPhone);
      return matchesQ && matchesSource && matchesPhone;
    });
  }, [contacts.items, q, source, phoneFilter]);

  const visibleActivities = React.useMemo(() => {
    if (!profile?.uid) return [];
    if (role !== "agent") return activities.items;
    return activities.items.filter((a) => {
      const createdBy = (a.createdBy ?? a.repId ?? "") as string;
      return createdBy === profile.uid;
    });
  }, [activities.items, role, profile?.uid]);

  const activityCountsByContactId = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of visibleActivities) {
      if (!a.contactId) continue;
      map.set(a.contactId, (map.get(a.contactId) ?? 0) + 1);
    }
    return map;
  }, [visibleActivities]);

  const visibleContacts = React.useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      if (sortBy === "name_asc") {
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      }
      if (sortBy === "name_desc") {
        return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
      }
      if (sortBy === "last_contact_asc") {
        return (tsToDate(a.lastContactAt)?.getTime() ?? 0) - (tsToDate(b.lastContactAt)?.getTime() ?? 0);
      }
      if (sortBy === "activity_desc") {
        return (
          (activityCountsByContactId.get(b.id ?? "") ?? 0) - (activityCountsByContactId.get(a.id ?? "") ?? 0)
        );
      }
      return (tsToDate(b.lastContactAt)?.getTime() ?? 0) - (tsToDate(a.lastContactAt)?.getTime() ?? 0);
    });
    return next;
  }, [filtered, sortBy, activityCountsByContactId]);

  const allSelected =
    visibleContacts.length > 0 && visibleContacts.every((c) => !!c.id && selectedIds.has(c.id));
  const someSelected = visibleContacts.some((c) => !!c.id && selectedIds.has(c.id));

  function toggleRow(contactId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
  }

  function toggleAllVisible(checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleContacts) {
        if (!c.id) continue;
        if (checked) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  }

  async function applyBulkSource() {
    if (!bulkSource || selectedIds.size === 0) return;
    const picked = visibleContacts.filter((c) => c.id && selectedIds.has(c.id));
    if (picked.length === 0) {
      toast.error("No visible contacts selected");
      return;
    }
    setBulkSaving(true);
    try {
      const batch = writeBatch(db);
      for (const c of picked) {
        if (!c.id) continue;
        batch.update(doc(db, "contacts", c.id), {
          source: bulkSource,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      toast.success(`Updated source for ${picked.length} contact${picked.length > 1 ? "s" : ""}`);
      setBulkSource("");
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk source update failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to apply bulk update");
    } finally {
      setBulkSaving(false);
    }
  }

  function MobileContactCard({
    contact,
    onClick,
  }: {
    contact: (typeof contacts.items)[number];
    onClick: (c: (typeof contacts.items)[number]) => void;
  }) {
    const initials = `${contact.firstName?.[0] ?? ""}${contact.lastName?.[0] ?? ""}`;
    const whatsappValue = contact.whatsapp || contact.phone || "";
    const waDigits = toWaNumber(whatsappValue);
    return (
      <div
        onClick={() => onClick(contact)}
        className="cursor-pointer rounded-xl border border-border bg-card p-4 active:bg-muted transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {initials || "B"}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {contact.firstName} {contact.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{contact.company ?? "—"}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5"
            >
              <Phone className="h-3 w-3" /> {contact.phone}
            </a>
          )}
          {waDigits && (
            <a
              href={`https://wa.me/${waDigits}`}
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 text-green-700"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

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
            <SelectItem value="all">All Sources</SelectItem>
            {SOURCE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={phoneFilter} onValueChange={(v) => setPhoneFilter(v as typeof phoneFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Phone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phones</SelectItem>
            <SelectItem value="with_phone">Has Phone</SelectItem>
            <SelectItem value="without_phone">No Phone</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_contact_desc">Sort: Last Contact (Newest)</SelectItem>
            <SelectItem value="last_contact_asc">Sort: Last Contact (Oldest)</SelectItem>
            <SelectItem value="name_asc">Sort: Name (A-Z)</SelectItem>
            <SelectItem value="name_desc">Sort: Name (Z-A)</SelectItem>
            <SelectItem value="activity_desc">Sort: Activities (High-Low)</SelectItem>
          </SelectContent>
        </Select>

        <div className="sm:ml-auto">
          <Button
            variant="outline"
            onClick={() => (setQ(""), setSource("all"), setPhoneFilter("all"), setSortBy("last_contact_desc"))}
          >
            Clear
          </Button>
        </div>
      </div>

      {contacts.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isMobile ? (
        <div className="grid gap-3">
          {visibleContacts.map((c) => (
            <MobileContactCard
              key={c.id}
              contact={c}
              onClick={(contact) => setSelectedId(contact.id)}
            />
          ))}
          {visibleContacts.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No contacts found.
            </div>
          )}
        </div>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="hidden items-center gap-2 rounded-lg border bg-muted/30 p-2 sm:flex">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <Select value={bulkSource} onValueChange={setBulkSource}>
                <SelectTrigger className="w-52 bg-background">
                  <SelectValue placeholder="Set source..." />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => void applyBulkSource()}
                disabled={!bulkSource || bulkSaving}
              >
                Apply Bulk Action
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
            </div>
          )}
          {/* Desktop table */}
          <div className="hidden rounded-xl border bg-card sm:block">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <div className="text-sm font-medium">All Contacts</div>
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                <SelectTrigger className="h-8 w-36 bg-background text-xs">
                  <SelectValue placeholder="Table View" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic View</SelectItem>
                  <SelectItem value="grid">Grid View</SelectItem>
                  <SelectItem value="table">Table View</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAllVisible(!!v)}
                      aria-label="Select all contacts"
                    />
                  </TableHead>
                  <TableHead>Last Name</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleContacts.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!c.id && selectedIds.has(c.id)}
                        onCheckedChange={(v) => c.id && toggleRow(c.id, !!v)}
                        aria-label={`Select ${c.firstName} ${c.lastName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.lastName || "—"}</TableCell>
                    <TableCell>{c.firstName || "—"}</TableCell>
                    <TableCell>{c.company ?? "—"}</TableCell>
                    <TableCell>{c.email ?? "—"}</TableCell>
                    <TableCell>{c.phone || c.whatsapp || "—"}</TableCell>
                    <TableCell>{c.source ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {visibleContacts.length === 0 && (
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
            {visibleContacts.map((c) => (
              <button
                key={c.id}
                className={cn("rounded-xl border bg-card p-4 text-left")}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="text-sm font-semibold">
                  {c.firstName} {c.lastName}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.company ?? "—"} • {c.phone || c.whatsapp || "—"}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Last contact: {tsToDate(c.lastContactAt)?.toLocaleDateString() ?? "—"}
                </div>
              </button>
            ))}
            {visibleContacts.length === 0 && (
              <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                No contacts found.
              </div>
            )}
          </div>
        </>
      )}

      <AddLeadModal
        preselectedContactId={preselectedContactId}
        externalOpen={addLeadOpen}
        onExternalOpenChange={setAddLeadOpen}
      />

      <ContactDetailDrawer
        contact={selected}
        open={!!selectedId}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  );
}

