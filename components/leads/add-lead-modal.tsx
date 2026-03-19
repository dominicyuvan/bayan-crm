"use client";

import * as React from "react";
import { addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { leadsCol } from "@/lib/firestore";
import type { Lead, LeadStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useTeamMembers, useFirestore } from "@/lib/firestore-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUSES: LeadStatus[] = ["New", "Contacted", "Qualified", "Won", "Lost"];

export function AddLeadModal() {
  const { profile } = useAuth();
  const contacts = useContacts();
  const team = useTeamMembers();
  const { cadences } = useFirestore();

  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [contactId, setContactId] = React.useState<string>("");
  const [propertyType, setPropertyType] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [valueOmr, setValueOmr] = React.useState<string>("");
  const [status, setStatus] = React.useState<LeadStatus>("New");
  const [source, setSource] = React.useState("");
  const [assignedRepId, setAssignedRepId] = React.useState<string>("");
  const [cadenceId, setCadenceId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (profile?.uid && !assignedRepId) setAssignedRepId(profile.uid);
  }, [profile?.uid, assignedRepId]);

  function reset() {
    setContactId("");
    setPropertyType("");
    setLocation("");
    setValueOmr("");
    setStatus("New");
    setSource("");
    setAssignedRepId(profile?.uid ?? "");
    setCadenceId("");
    setNotes("");
  }

  async function onSave() {
    if (!contactId) {
      toast.error("Contact is required");
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
        source: source.trim(),
        assignedRepId: assignedRepId,
        cadenceId: cadenceId,
        cadenceStepIndex: cadenceId ? 0 : null,
        notes: notes.trim(),
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
      <DialogTrigger asChild>
        <Button>Add Lead</Button>
      </DialogTrigger>
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
              <Label>Property Type</Label>
              <Input value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
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
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Assigned Rep</Label>
              <Select value={assignedRepId} onValueChange={setAssignedRepId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rep" />
                </SelectTrigger>
                <SelectContent>
                  {team.items.map((m) => (
                    <SelectItem key={m.id} value={m.id ?? m.email}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cadence</Label>
              <Select value={cadenceId} onValueChange={setCadenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {cadences.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} />
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

