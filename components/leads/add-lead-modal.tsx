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

const PROPERTY_TYPES = ["Office", "Retail", "Warehouse", "Industrial", "Mixed", "Other"];
const SOURCES = [
  "Referral",
  "Exhibition",
  "Website",
  "Cold call",
  "Walk-in",
  "WhatsApp",
  "Other",
];

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
  const contacts = useContacts();
  const status: LeadStatus = "Initial Contact";

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [contactId, setContactId] = React.useState<string>("");
  const [contactSearch, setContactSearch] = React.useState("");
  const [showContactResults, setShowContactResults] = React.useState(false);
  const [selectedContactName, setSelectedContactName] = React.useState("");
  const [propertyType, setPropertyType] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [valueOmr, setValueOmr] = React.useState<string>("");
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
    setValueOmr("");
    setSource("");
    setNotes("");
  }

  async function onSave() {
    if (!contactId) {
      toast.error("Contact is required");
      return;
    }
    if (!propertyType.trim()) {
      toast.error("Property type is required");
      return;
    }
    setSubmitting(true);
    try {
      const parsedValue =
        valueOmr.trim() === "" ? null : Number(valueOmr.replace(/,/g, ""));
      if (parsedValue !== null && !Number.isFinite(parsedValue)) {
        toast.error("Value must be a number");
        return;
      }

      const payload = {
        contactId,
        propertyType: propertyType.trim(),
        location: location.trim(),
        valueOmr: parsedValue,
        status,
        source: source.trim() || "",
        notes: notes.trim() || "",
        assignedTo: profile?.displayName || "",
        assignedToUid: profile?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastContactAt: serverTimestamp(),
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
          <Button>Add Lead</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add lead</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>
              Contact <span className="text-destructive">*</span>
            </Label>
            {contactId && !showContactResults ? (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {selectedContactName[0] ?? ""}
                </div>
                <span className="flex-1 text-sm font-medium">{selectedContactName}</span>
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>
                Property Type <span className="text-destructive">*</span>
              </Label>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Value (OMR)</Label>
              <Input value={valueOmr} onChange={(e) => setValueOmr(e.target.value)} placeholder="e.g. 25,000.000" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
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

