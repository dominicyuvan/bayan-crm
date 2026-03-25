"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const AGENT_BLOCKED_PREFIXES = ["/team", "/reports", "/integrations", "/cadences"];
const MANAGER_BLOCKED_PREFIXES = ["/integrations"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  React.useEffect(() => {
    if (!profile?.role) return;
    const role = profile.role;
    const path = pathname ?? "/";

    const blocked =
      role === "agent"
        ? AGENT_BLOCKED_PREFIXES
        : role === "manager"
        ? MANAGER_BLOCKED_PREFIXES
        : [];

    if (blocked.some((p) => path === p || path.startsWith(`${p}/`))) {
      toast.error("You don't have permission to access this page");
      router.replace("/dashboard");
    }
  }, [profile?.role, pathname, router]);

  return <>{children}</>;
}

