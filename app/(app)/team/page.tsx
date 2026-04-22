"use client";

import * as React from "react";
import { startOfMonth } from "date-fns";
import { toast } from "sonner";
import { addDoc, doc, serverTimestamp, updateDoc, type WithFieldValue } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useFirestore, useLeads, useActivities, useTeamMembers } from "@/lib/firestore-provider";
import type { TeamMember } from "@/lib/types";
import { db } from "@/lib/firebase";
import { teamMembersCol } from "@/lib/firestore";
import { formatOMR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type MemberRoleOption = "admin" | "manager" | "sales_executive";

function computeStatsForMember(
  member: TeamMember & { id: string },
  leads: ReturnType<typeof useLeads>["items"],
  activities: ReturnType<typeof useActivities>["items"]
) {
  const monthStart = startOfMonth(new Date());
  const memberLeads = leads.filter(
    (l) => (l.assignedToUid ?? l.assignedRepId ?? "") === member.id
  );
  const leadsCount = memberLeads.length;
  const wonDeals = memberLeads.filter((l) => l.status === "Won").length;
  const pipelineValue = memberLeads.reduce(
    (sum, l) => sum + (l.valueOmr ?? 0),
    0
  );

  const memberActivities = activities.filter(
    (a) => {
      const createdBy = (a.createdBy ?? a.repId ?? "") as string;
      if (createdBy !== member.id) return false;
      const date = a.createdAt?.toDate?.() ?? (a.occurredAt as any)?.toDate?.();
      return !!date && date >= monthStart;
    }
  );

  const activitiesThisMonth = memberActivities.length;
  const conversionRate =
    leadsCount > 0 ? Math.round((wonDeals / leadsCount) * 100) : 0;

  return { leadsCount, wonDeals, activitiesThisMonth, pipelineValue, conversionRate };
}

function AddEditMemberDialog({
  mode,
  member,
}: {
  mode: "add" | "edit";
  member?: (TeamMember & { id: string }) | null;
}) {
  const { profile: userProfile } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [name, setName] = React.useState(member?.name ?? "");
  const [email, setEmail] = React.useState(member?.email ?? "");
  const [role, setRole] = React.useState<MemberRoleOption>(
    (member?.role as MemberRoleOption) ?? "sales_executive"
  );
  const [phone, setPhone] = React.useState(member?.phone ?? "");
  const [status, setStatus] = React.useState<"active" | "inactive">(
    member?.status ?? "active"
  );

  React.useEffect(() => {
    if (member && mode === "edit" && open) {
      setName(member.name ?? "");
      setEmail(member.email ?? "");
      setRole((member.role as MemberRoleOption) ?? "sales_executive");
      setPhone(member.phone ?? "");
      setStatus(member.status ?? "active");
    }
  }, [member, mode, open]);

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!email.toLowerCase().endsWith("@bayaninvestment.com")) {
      toast.error("Email must be @bayaninvestment.com");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "add") {
        const payload = {
          name: name.trim(),
          email: email.toLowerCase(),
          role,
          phone: phone.trim(),
          status,
          isActive: status === "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
        } satisfies WithFieldValue<TeamMember>;

        await addDoc(teamMembersCol, payload);

        // Send invite email to newly added team member (non-blocking for save).
        try {
          await fetch("/api/email/invite", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-cron-secret":
                process.env.NEXT_PUBLIC_CRON_SECRET ||
                "bayan_cron_secret_2024",
            },
            body: JSON.stringify({
              name: name.trim(),
              email: email.toLowerCase(),
              role,
              invitedBy: userProfile?.displayName || "Admin",
            }),
          });
        } catch (inviteErr) {
          toast.error(
            inviteErr instanceof Error
              ? `Saved team member, but invite email failed: ${inviteErr.message}`
              : "Saved team member, but invite email failed"
          );
        }
      } else if (member) {
        const ref = doc(db, "team_members", member.id);
        await updateDoc(ref, {
          name: name.trim(),
          displayName: name.trim(),
          email: email.toLowerCase(),
          role,
          phone: phone.trim(),
          status,
          isActive: status === "active",
          updatedAt: serverTimestamp(),
        } as any);
      }

      toast.success("Team member saved");
      setOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save team member"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "add" ? "Add team member" : "Edit team member";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "add" ? (
          <Button size="sm">Add Team Member</Button>
        ) : (
          <Button size="xs" variant="outline">
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@bayaninvestment.com"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as MemberRoleOption)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="sales_executive">Sales Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+968..."
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "inactive")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamPage() {
  const { profile } = useAuth();
  const { leads, activities } = useFirestore();
  const team = useTeamMembers();

  const role = profile?.role ?? "agent";
  const isAdmin = role === "admin";
  const isManager = role === "manager" || isAdmin;

  if (!isManager) {
    return (
      <div className="space-y-2">
        <div className="text-lg font-semibold tracking-tight">Team</div>
        <div className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </div>
      </div>
    );
  }

  if (team.loading || leads.loading || activities.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const membersWithStats = team.items
    .filter((m) => m.status !== "inactive")
    .map((m) => ({
      member: m,
      stats: computeStatsForMember(m as TeamMember & { id: string }, leads.items, activities.items),
    }))
    .sort((a, b) => b.stats.wonDeals - a.stats.wonDeals);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold tracking-tight">
            Team performance
          </div>
          <div className="text-sm text-muted-foreground">
            Overview of your sales team&apos;s pipeline and activity.
          </div>
        </div>
        {isAdmin && <AddEditMemberDialog mode="add" />}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {membersWithStats.map(({ member, stats }) => (
          <Card key={member.id} className="p-4">
            <div className="text-sm font-semibold">{member.displayName}</div>
            <div className="text-xs text-muted-foreground">
              {member.role === "sales_executive" ? "Agent" : member.role}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Leads</div>
                <div className="font-semibold">{stats.leadsCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Won</div>
                <div className="font-semibold">{stats.wonDeals}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Activities (month)</div>
                <div className="font-semibold">{stats.activitiesThisMonth}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Pipeline</div>
                <div className="font-semibold">
                  {formatOMR(stats.pipelineValue)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Conversion</div>
                <div className="font-semibold">
                  {stats.conversionRate}
                  <span className="text-[11px] text-muted-foreground"> %</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {membersWithStats.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No team members yet. Add your first team member to get started.
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Team management</div>
              <div className="text-xs text-muted-foreground">
                Manage roles, access, and status for your team.
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.displayName ?? m.email}
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      {m.role === "sales_executive" ? "Sales Executive" : m.role}
                    </TableCell>
                    <TableCell>{m.phone ?? "—"}</TableCell>
                    <TableCell className="capitalize">
                      {m.status ?? (m.isActive ? "active" : "inactive")}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <AddEditMemberDialog mode="edit" member={m as any} />
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const ref = doc(db, "team_members", m.id!);
                            await updateDoc(ref, {
                              status: "inactive",
                              isActive: false,
                              updatedAt: serverTimestamp(),
                            } as any);
                            toast.success("Team member deactivated");
                          } catch (err) {
                            toast.error(
                              err instanceof Error
                                ? err.message
                                : "Failed to deactivate"
                            );
                          }
                        }}
                      >
                        Deactivate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {team.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No team members yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

