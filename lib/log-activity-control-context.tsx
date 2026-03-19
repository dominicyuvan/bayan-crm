"use client";

import * as React from "react";
import { LogActivityFab } from "@/components/log-activity-fab";

type LogActivityControlContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const LogActivityControlContext =
  React.createContext<LogActivityControlContextValue | null>(null);

export function LogActivityControlProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <LogActivityControlContext.Provider value={{ open, setOpen }}>
      {children}
      <LogActivityFab externalOpen={open} onExternalOpenChange={setOpen} />
    </LogActivityControlContext.Provider>
  );
}

export function useLogActivityControl() {
  const ctx = React.useContext(LogActivityControlContext);
  if (!ctx) throw new Error("useLogActivityControl must be used within provider");
  return ctx;
}

