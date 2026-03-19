"use client";

import * as React from "react";
import { addDays, startOfDay, subDays } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useFirestore } from "@/lib/firestore-provider";
import { tsToDate } from "@/lib/firestore";
import { formatOMR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ReportsPage() {
  const { profile } = useAuth();
  const { leads, activities, tasks, teamMembers } = useFirestore();

  const role = profile?.role ?? "agent";
  const isManagerOrAdmin = role === "manager" || role === "admin";

  const [from, setFrom] = React.useState(
    startOfDay(subDays(new Date(), 30)).toISOString().slice(0, 10)
  );
  const [to, setTo] = React.useState(
    startOfDay(new Date()).toISOString().slice(0, 10)
  );

  if (!isManagerOrAdmin) {
    return (
      <div className="space-y-2">
        <div className="text-lg font-semibold tracking-tight">Reports</div>
        <div className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </div>
      </div>
    );
  }

  if (leads.loading || activities.loading || tasks.loading || teamMembers.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const fromDate = startOfDay(new Date(from));
  const toDate = addDays(startOfDay(new Date(to)), 1); // inclusive

  const reps = teamMembers.items;

  const rows = reps.map((rep) => {
    const repLeads = leads.items.filter(
      (l) => (l.assignedToUid ?? l.assignedRepId ?? "") === rep.uid
    );
    const repTasks = tasks.items.filter((t) => t.assignedToId === rep.uid);
    const repActivities = activities.items.filter((a) => a.repId === rep.uid);

    const inRangeLeads = repLeads.filter((l) => {
      const created = tsToDate(l.createdAt);
      return !!created && created >= fromDate && created < toDate;
    });

    const won = inRangeLeads.filter((l) => l.status === "Won");
    const lost = inRangeLeads.filter((l) => l.status === "Lost");

    const pipeline = inRangeLeads.reduce(
      (sum, l) =>
        sum + (l.status !== "Lost" && l.status !== "Won" ? (l.valueOmr ?? 0) : 0),
      0
    );
    const wonValue = won.reduce((sum, l) => sum + (l.valueOmr ?? 0), 0);

    const inRangeActivities = repActivities.filter((a) => {
      const d = tsToDate(a.occurredAt);
      return !!d && d >= fromDate && d < toDate;
    });

    const inRangeTasks = repTasks.filter((t) => {
      const d = tsToDate(t.dueAt);
      return !!d && d >= fromDate && d < toDate;
    });

    const completedTasks = repTasks.filter((t) => t.status === "completed");

    const conversion =
      inRangeLeads.length > 0
        ? Math.round((won.length / inRangeLeads.length) * 100)
        : 0;

    return {
      rep,
      leads: inRangeLeads.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      pipeline,
      wonValue,
      activities: inRangeActivities.length,
      tasksDue: inRangeTasks.length,
      tasksCompleted: completedTasks.length,
      conversion,
    };
  });

  const chartData = rows.map((r) => ({
    name: r.rep.name,
    New: r.leads,
    Won: r.wonDeals,
    Lost: r.lostDeals,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-lg font-semibold tracking-tight">Reports</div>
          <div className="text-sm text-muted-foreground">
            Team performance, pipeline health, and conversion by rep.
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">To</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFrom(startOfDay(subDays(new Date(), 30)).toISOString().slice(0, 10));
              setTo(startOfDay(new Date()).toISOString().slice(0, 10));
            }}
          >
            Last 30 days
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-3 text-sm">
        <table className="w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Rep</th>
              <th className="py-2 pr-4 font-medium">Leads</th>
              <th className="py-2 pr-4 font-medium">Won</th>
              <th className="py-2 pr-4 font-medium">Lost</th>
              <th className="py-2 pr-4 font-medium">Pipeline</th>
              <th className="py-2 pr-4 font-medium">Won value</th>
              <th className="py-2 pr-4 font-medium">Activities</th>
              <th className="py-2 pr-4 font-medium">Tasks due</th>
              <th className="py-2 pr-4 font-medium">Tasks completed</th>
              <th className="py-2 pr-4 font-medium">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rep.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{r.rep.name}</td>
                <td className="py-2 pr-4">{r.leads}</td>
                <td className="py-2 pr-4">{r.wonDeals}</td>
                <td className="py-2 pr-4">{r.lostDeals}</td>
                <td className="py-2 pr-4">{formatOMR(r.pipeline)}</td>
                <td className="py-2 pr-4">{formatOMR(r.wonValue)}</td>
                <td className="py-2 pr-4">{r.activities}</td>
                <td className="py-2 pr-4">{r.tasksDue}</td>
                <td className="py-2 pr-4">{r.tasksCompleted}</td>
                <td className="py-2 pr-4">{r.conversion}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  No team members or activity in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="h-72 p-4">
        <div className="mb-2 text-sm font-medium">Pipeline by status</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="New" stackId="a" fill="var(--chart-1)" />
            <Bar dataKey="Won" stackId="a" fill="var(--chart-3)" />
            <Bar dataKey="Lost" stackId="a" fill="var(--chart-5)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

