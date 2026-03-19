"use client";

import * as React from "react";

type LogActivityContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const LogActivityContext = React.createContext<LogActivityContextValue | null>(null);

export function LogActivityProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const value = React.useMemo(() => ({ open, setOpen }), [open]);
  return (
    <LogActivityContext.Provider value={value}>{children}</LogActivityContext.Provider>
  );
}

export function useLogActivity() {
  const ctx = React.useContext(LogActivityContext);
  if (!ctx) throw new Error("useLogActivity must be used within LogActivityProvider");
  return ctx;
}
