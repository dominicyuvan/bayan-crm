"use client";

import * as React from "react";
import { useLeads, useFirestore } from "@/lib/firestore-provider";
import { DEFAULT_CADENCES } from "@/lib/cadence-templates";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CadencesPage() {
  const { cadences } = useFirestore();
  const leads = useLeads();

  const allCadences = React.useMemo(
    () => [...DEFAULT_CADENCES, ...cadences.items],
    [cadences.items]
  );

  const withStats = React.useMemo(
    () =>
      allCadences.map((c) => {
        const activeLeads = leads.items.filter((l) => l.cadenceId === c.id).length;
        return { cadence: c, activeLeads };
      }),
    [allCadences, leads.items]
  );

  if (cadences.loading || leads.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-6 w-64" />
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-lg font-semibold tracking-tight">Cadences</div>
        <div className="text-sm text-muted-foreground">
          Standard follow-up playbooks with real-time engagement stats.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {withStats.map(({ cadence, activeLeads }) => (
          <Card key={cadence.id} className="flex flex-col gap-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">{cadence.name}</div>
              <div className="text-xs text-muted-foreground">
                {cadence.durationDays} days
              </div>
            </div>
            {cadence.description && (
              <div className="text-xs text-muted-foreground">
                {cadence.description}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <div className="text-muted-foreground">Active leads</div>
              <div className="font-semibold">{activeLeads}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              {cadence.steps.map((s) => (
                <div
                  key={s.id ?? s.title}
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5"
                >
                  <span className="font-semibold">D+{s.dayOffset}</span>
                  <span>{s.title}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

