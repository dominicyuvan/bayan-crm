"use client";

import * as React from "react";
import { read, utils } from "xlsx";
import { addDoc, serverTimestamp, type WithFieldValue } from "firebase/firestore";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import type { Contact } from "@/lib/types";
import { contactsCol } from "@/lib/firestore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Mapping = {
  name: string;
  phone: string;
  email: string;
  company: string;
};

export default function IntegrationsPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "agent";
  const isAdmin = role === "admin";

  const [file, setFile] = React.useState<File | null>(null);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<Mapping>({
    name: "",
    phone: "",
    email: "",
    company: "",
  });
  const [parsing, setParsing] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <div className="text-lg font-semibold tracking-tight">Integrations</div>
        <div className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </div>
      </div>
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    try {
      const buf = await f.arrayBuffer();
      const wb = read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][];
      const header = (rows[0] ?? []).map((h) => String(h));
      setColumns(header);
      toast.success("File parsed. Map the columns below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!file) {
      toast.error("Please choose a CSV/Excel file");
      return;
    }
    if (!mapping.phone) {
      toast.error("Phone column is required");
      return;
    }
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json<Record<string, any>>(sheet);

      let imported = 0;
      for (const row of rows) {
        const nameVal = mapping.name ? String(row[mapping.name] ?? "") : "";
        const [firstName, ...restName] = nameVal.split(" ");
        const lastName = restName.join(" ");
        const phone = String(row[mapping.phone] ?? "").trim();
        if (!phone) continue;

        const payload = {
          firstName: firstName || "",
          lastName: lastName || "",
          phone,
          alternatePhone: "",
          whatsapp: "",
          email: mapping.email ? String(row[mapping.email] ?? "") : "",
          company: mapping.company ? String(row[mapping.company] ?? "") : "",
          jobTitle: "",
          source: "Import",
            assignedTo: profile?.displayName || "",
            assignedToUid: profile?.uid || "",
          tags: [],
          notes: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastContactAt: serverTimestamp(),
        } satisfies WithFieldValue<Contact>;

        await addDoc(contactsCol, payload);
        imported += 1;
      }

      toast.success(`Imported ${imported} contacts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold tracking-tight">Integrations</div>
        <div className="text-sm text-muted-foreground">
          Import contacts from Excel/CSV and other systems.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">Excel / CSV import</div>
          <div className="text-xs text-muted-foreground">
            Upload a spreadsheet of contacts, map your columns, and save them to
            Bayan CRM.
          </div>
          <div className="grid gap-2">
            <Label>File</Label>
            <Input
              type="file"
              accept=".csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              disabled={parsing || importing}
            />
          </div>
          {parsing && <Skeleton className="h-4 w-40" />}
          {columns.length > 0 && (
            <div className="grid gap-2 text-xs">
              <div className="font-medium">Column mapping</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label>Name</Label>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={mapping.name}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, name: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Phone *</Label>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={mapping.phone}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, phone: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={mapping.email}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, email: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Company</Label>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={mapping.company}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, company: e.target.value }))
                    }
                  >
                    <option value="">—</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2">
                <Button size="sm" onClick={handleImport} disabled={importing}>
                  Import
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-2 text-sm text-muted-foreground">
          <div className="text-sm font-semibold text-foreground">
            Coming soon
          </div>
          <ul className="list-disc pl-5 space-y-1">
            <li>WhatsApp chat export parser</li>
            <li>CRM-to-CRM integrations</li>
            <li>Scheduled nightly syncs</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

