"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { LogActivityFab } from "@/components/log-activity-fab";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="grid min-h-dvh grid-cols-[260px_1fr]">
          <div className="hidden border-r bg-sidebar sm:block">
            <div className="p-4">
              <Skeleton className="h-8 w-32 bg-white/10" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="border-b p-4">
              <Skeleton className="h-9 w-full max-w-lg" />
            </div>
            <div className="p-6">
              <Skeleton className="h-28 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-background">
      <div
        className={
          sidebarCollapsed
            ? "grid min-h-dvh grid-cols-[72px_1fr]"
            : "grid min-h-dvh grid-cols-[260px_1fr]"
        }
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          activePath={pathname}
        />
        <div className="min-w-0">
          <TopBar />
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>

      <LogActivityFab />
      <Toaster richColors closeButton />
    </div>
  );
}

