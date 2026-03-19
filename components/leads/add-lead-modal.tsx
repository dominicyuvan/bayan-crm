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
  const status: LeadStatus = "New";

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [contactId, setContactId] = React.useState<string>("");
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
  }, [preselectedContactId]);

  function reset() {
    setContactId("");
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
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.items.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} {c.company ? `• ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

