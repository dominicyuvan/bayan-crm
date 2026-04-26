"use client";

import * as React from "react";
import { addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { leadsCol } from "@/lib/firestore";
import type { Lead, LeadStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useContacts } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { canManageEntity } from "@/lib/permissions";

const PROPERTY_TYPES = [
  "Office",
  "Retail",
  "Warehouse",
  "Industrial",
  "Land",
  "Villa",
  "Mixed Use",
  "Other",
];
const SOURCE_OPTIONS = ["Walk In", "Exhibition", "Instagram", "Advertisement", "Call", "Other"];
export type AddLeadModalProps = {
  preselectedContactId?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
};

export function AddLeadModal({
  preselectedContactId,
  externalOpen,
  onExternalOpenChange,
}: AddLeadModalProps) {
  const { profile } = useAuth();
  const canCreateLead = canManageEntity({
    role: profile?.role,
    entity: "leads",
    action: "create",
  });
  const contacts = useContacts();

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [contactId, setContactId] = React.useState<string>("");
  const [contactSearch, setContactSearch] = React.useState("");
  const [showContactResults, setShowContactResults] = React.useState(false);
  const [selectedContactName, setSelectedContactName] = React.useState("");
  const [propertyType, setPropertyType] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [unitSize, setUnitSize] = React.useState("");
  const [budgetMin, setBudgetMin] = React.useState("");
  const [budgetMax, setBudgetMax] = React.useState("");
  const [status, setStatus] = React.useState<LeadStatus>("initial_contact");
  const [source, setSource] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const isControlled =
    typeof externalOpen === "boolean" && typeof onExternalOpenChange === "function";
  const open = isControlled ? externalOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (isControlled) onExternalOpenChange(next);
      else setUncontrolledOpen(next);
    },
    [isControlled, onExternalOpenChange]
  );

  React.useEffect(() => {
    if (!preselectedContactId) return;
    setContactId(preselectedContactId);
    const c = contacts.items.find((x) => x.id === preselectedContactId);
    const name = c ? `${c.firstName} ${c.lastName}`.trim() : "";
    setSelectedContactName(name);
    setContactSearch(name);
    setShowContactResults(false);
  }, [preselectedContactId, contacts.items]);

  const filteredContacts = React.useMemo(() => {
    if (!contactSearch || contactSearch.length < 1) return [];
    const q = contactSearch.toLowerCase();
    return contacts.items
      .filter((c) => {
        const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.company ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [contacts.items, contactSearch]);

  function reset() {
    setContactId("");
    setContactSearch("");
    setShowContactResults(false);
    setSelectedContactName("");
    setPropertyType("");
    setLocation("");
    setUnitSize("");
    setBudgetMin("");
    setBudgetMax("");
    setStatus("initial_contact");
    setSource("");
    setNotes("");
  }

  async function onSave() {
    if (!canCreateLead) {
      toast.error("You do not have permission to add leads");
      return;
    }

    if (!contactId) {
      toast.error("Contact is required");
      return;
    }
    setSubmitting(true);
    try {
      const selectedContact = contacts.items.find((c) => c.id === contactId);
      const selectedContactPhone = selectedContact?.phone ?? "";
      const selectedContactCompany = selectedContact?.company ?? "";
      const numericBudgetMin = parseFloat(budgetMin) || 0;
      const numericBudgetMax = parseFloat(budgetMax) || 0;
      const selectedContactNameSafe = selectedContactName || "Unknown Contact";

      const payload = {
        contactId: contactId,
        contactName: selectedContactNameSafe,
        contactPhone: selectedContactPhone || "",
        company: selectedContactCompany || "",
        propertyType: propertyType.trim() || "Unknown",
        location: location.trim(),
        value: numericBudgetMax || numericBudgetMin || 0,
        status: status || "initial_contact",
        temperature: "warm",
        score: 30,
        source: source || "",
        notes: notes.trim() || "",
        assignedTo: profile?.displayName || "",
        assignedToUid: profile?.uid || "",
        nextAction: "Initial contact",
        nextActionDue: null,
        lastContactedAt: null,
        daysInPipeline: 0,
        cadenceId: null,
        cadenceStep: 0,
        cadenceNextDue: null,
        budgetMin: numericBudgetMin,
        budgetMax: numericBudgetMax,
        unitSize: unitSize.trim() || "",
        createdBy: profile?.uid || "",
        createdByName: profile?.displayName || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastContactAt: null,
      } satisfies WithFieldValue<Lead>;

      await addDoc(leadsCol, payload);

      toast.success("Lead saved");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save lead");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          <Button disabled={!canCreateLead}>Add Lead</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold">Contact</p>
            <div className="grid gap-2">
            <Label>
              Contact <span className="text-destructive">*</span>
            </Label>
              {contactId && !showContactResults ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <Badge variant="secondary" className="max-w-full">
                    {selectedContactName}
                  </Badge>
                <button
                  type="button"
                  onClick={() => {
                    setContactId("");
                    setSelectedContactName("");
                    setContactSearch("");
                    setShowContactResults(false);
                  }}
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search by name or phone..."
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactResults(e.target.value.length > 0);
                    if (!e.target.value) setContactId("");
                  }}
                  className="h-10"
                  autoComplete="off"
                />

                {showContactResults && filteredContacts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-border bg-background shadow-xl">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          const name = `${contact.firstName} ${contact.lastName}`.trim();
                          setContactId(contact.id);
                          setSelectedContactName(name);
                          setContactSearch(name);
                          setShowContactResults(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted text-left border-b border-border/50 last:border-0"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                          {contact.firstName?.[0]}
                          {contact.lastName?.[0] || ""}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {contact.firstName} {contact.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.phone || contact.company || contact.email}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showContactResults &&
                  contactSearch.length > 1 &&
                  filteredContacts.length === 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-background p-3 shadow-xl">
                      <p className="text-center text-sm text-muted-foreground">
                        No contact found —
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                          }}
                          className="ml-1 text-primary underline"
                        >
                          Add contact first
                        </button>
                      </p>
                    </div>
                  )}
              </div>
            )}
          </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Property Requirements</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Property Type</Label>
                <Input
                  list="lead-property-types"
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  placeholder="Select or type property type"
                />
                <datalist id="lead-property-types">
                  {PROPERTY_TYPES.map((typeOption) => (
                    <option key={typeOption} value={typeOption} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Label>Preferred Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. CBD Muscat, Al Khoud"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Unit Size</Label>
              <Input
                value={unitSize}
                onChange={(e) => setUnitSize(e.target.value)}
                placeholder="e.g. 200-300 sqm, 1 floor"
              />
            </div>
            <div className="space-y-2">
              <Label>Budget Range (OMR)</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(e.target.value)}
                    className="font-mono pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    OMR
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="Max"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(e.target.value)}
                    className="font-mono pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    OMR
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Lead Details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as LeadStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial_contact">Initial Contact</SelectItem>
                    <SelectItem value="arrange_visit">Arrange Visit</SelectItem>
                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((sourceOption) => (
                      <SelectItem key={sourceOption} value={sourceOption}>
                        {sourceOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold">Lead Owner</p>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {profile?.displayName?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Lead Owner</p>
                <p className="text-sm font-medium">{profile?.displayName}</p>
              </div>
              <Badge variant="outline" className="text-xs capitalize">
                {profile?.role}
              </Badge>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={submitting}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

