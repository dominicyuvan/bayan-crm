"use client";

import * as React from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firestore";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function AddContactModal() {
  const { profile } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [source, setSource] = React.useState("");
  const [notes, setNotes] = React.useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setWhatsapp("");
    setEmail("");
    setCompany("");
    setSource("");
    setNotes("");
  }

  async function handleSubmit() {
    const formData = {
      firstName,
      lastName,
      phone,
      whatsapp,
      email,
      company,
      source,
      notes,
    };
    console.log("handleSubmit called", formData);

    if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.phone?.trim()) {
      toast.error("First name, last name and phone are required");
      return;
    }
    if (!profile) {
      toast.error("You must be logged in");
      return;
    }

    setSubmitting(true);
    try {
      const contactData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp?.trim() || "",
        email: formData.email?.trim() || "",
        company: formData.company?.trim() || "",
        source: formData.source || "",
        notes: formData.notes?.trim() || "",
        tags: [],
        assignedTo: profile.displayName || "",
        assignedToUid: profile.uid || "",
        lastContactedAt: null,
        lastContactAt: serverTimestamp(),
        createdBy: profile.uid,
        createdByName: profile.displayName || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log("Writing to Firestore:", contactData);
      console.log("About to write:", contactData);
      const ref = await addDoc(collection(db, "contacts"), contactData);
      console.log("Written successfully:", ref.id);

      toast.success(`${formData.firstName} added successfully`);
      reset();
      setOpen(false);
    } catch (err) {
      console.error("FULL ERROR:", err, JSON.stringify(err));
      console.error("Save error:", err);
      toast.error(
        `Failed to save: ${
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message ?? "Unknown error")
            : "Unknown error"
        }`
      );
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
        <Button>Add Contact</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Referral",
                    "Exhibition",
                    "Website",
                    "Cold call",
                    "Walk-in",
                    "WhatsApp",
                    "Other",
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

