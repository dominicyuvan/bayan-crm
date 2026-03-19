"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Target, CheckSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  onLogActivity: () => void;
}

export function MobileNav({ onLogActivity }: MobileNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { href: "/contacts", icon: Users, label: "Contacts" },
    { href: "/leads", icon: Target, label: "Leads" },
    { href: "/tasks", icon: CheckSquare, label: "Tasks" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-end justify-around px-2 pt-2 pb-1">
        {tabs.slice(0, 2).map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 px-3 py-1"
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}

        <button
          onClick={onLogActivity}
          className="flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 px-3 py-1 -mt-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
            <Plus className="h-6 w-6 text-white" />
          </div>
          <span className="text-[10px] text-muted-foreground">Log</span>
        </button>

        {tabs.slice(2).map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex min-h-[44px] min-w-[44px] flex-col items-center gap-1 px-3 py-1"
            >
              <Icon
                className={cn(
                  "h-6 w-6",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-[10px]",
                  isActive ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

