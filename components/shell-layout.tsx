"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { TopBar } from "@/components/top-bar";
import { MobileNav } from "@/components/mobile-nav";
import { AuthGuard } from "@/components/auth-guard";
import { useIsMobile } from "@/hooks/use-mobile";

export function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <div
        className={
          isMobile
            ? "flex min-h-dvh flex-col"
            : sidebarCollapsed
            ? "grid min-h-dvh grid-cols-[72px_1fr]"
            : "grid min-h-dvh grid-cols-[260px_1fr]"
        }
      >
        <AppSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          activePath={pathname ?? "/"}
          hideCollapseOnMobile={isMobile}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 pb-20 sm:p-6 md:pb-6">
            <AuthGuard>{children}</AuthGuard>
          </main>
        </div>
      </div>
      <MobileNav onLogActivity={() => {}} />
    </div>
  );
}
