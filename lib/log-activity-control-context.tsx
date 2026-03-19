"use client";

import * as React from "react";
import { LogActivityFab } from "@/components/log-activity-fab";

type LogActivityControlContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  setPreselectedLeadId: (leadId: string | null) => void;
  setPreselectedContactId: (contactId: string | null) => void;
};

const LogActivityControlContext =
  React.createContext<LogActivityControlContextValue | null>(null);

export function LogActivityControlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [preselectedLeadId, setPreselectedLeadId] = React.useState<string | null>(null);
  const [preselectedContactId, setPreselectedContactId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) return;
    // Clear stale selections when the panel closes.
    setPreselectedLeadId(null);
    setPreselectedContactId(null);
  }, [open]);

  return (
    <LogActivityControlContext.Provider
      value={{
        open,
        setOpen,
        setPreselectedLeadId,
        setPreselectedContactId,
      }}
    >
      {children}
      <LogActivityFab
        externalOpen={open}
        onExternalOpenChange={setOpen}
        preselectedLeadId={preselectedLeadId ?? undefined}
        preselectedContactId={preselectedContactId ?? undefined}
      />
    </LogActivityControlContext.Provider>
  );
}

export function useLogActivityControl() {
  const ctx = React.useContext(LogActivityControlContext);
  if (!ctx) throw new Error("useLogActivityControl must be used within provider");
  return ctx;
}

