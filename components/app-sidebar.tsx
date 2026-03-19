"use client";

import Link from "next/link";
import {
  BarChart3Icon,
  Building2Icon,
  CalendarClockIcon,
  ChevronsLeftRightIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  managerOnly?: boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/contacts", label: "Contacts", icon: Building2Icon },
  { href: "/leads", label: "Leads", icon: WorkflowIcon },
  { href: "/tasks", label: "Tasks", icon: CalendarClockIcon },
  {
    href: "/cadences",
    label: "Cadences",
    icon: Settings2Icon,
    managerOnly: true,
  },
  { href: "/team", label: "Team", icon: UsersIcon, adminOnly: true },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3Icon,
    managerOnly: true,
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Settings2Icon,
    adminOnly: true,
  },
];

export function AppSidebar({
  collapsed,
  onToggleCollapsed,
  activePath,
  hideCollapseOnMobile = false,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activePath: string;
  hideCollapseOnMobile?: boolean;
}) {
  const { profile } = useAuth();
  const role = profile?.role ?? "agent";
  const isAdmin = role === "admin";
  const isManager = role === "manager" || isAdmin;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground sm:flex",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center justify-between gap-2 p-4">
        <div className={cn("min-w-0", collapsed && "sr-only")}>
          <div className="text-sm font-semibold tracking-tight">Bayan CRM</div>
          <div className="text-xs text-white/60">Sales workspace</div>
        </div>
        {!hideCollapseOnMobile && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onToggleCollapsed}
          >
            <ChevronsLeftRightIcon className="size-4" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems
          .filter((i) => {
            if (i.adminOnly) return isAdmin;
            if (i.managerOnly) return isManager;
            return true;
          })
          .map((item) => {
            const active = activePath === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10",
                  active && "bg-white/10 text-white",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn("truncate", collapsed && "sr-only")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-white/10 text-white">
              {profile?.initials ?? "U"}
            </AvatarFallback>
          </Avatar>
            <div className={cn("min-w-0", collapsed && "sr-only")}>
              <div className="truncate text-sm font-medium">
                {profile?.displayName ?? profile?.email ?? "User"}
              </div>
              <div className="truncate text-xs text-white/60">
                {profile?.role ?? ""}
              </div>
            </div>
        </div>
      </div>
    </aside>
  );
}

