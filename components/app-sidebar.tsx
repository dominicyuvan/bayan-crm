"use client";

import Link from "next/link";
import {
  BarChart2Icon,
  Building2Icon,
  CalendarClockIcon,
  ChevronsLeftRightIcon,
  LayoutDashboardIcon,
  Settings2Icon,
  UsersRound,
  WorkflowIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ("admin" | "manager")[];
  managerOnly?: boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", name: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/contacts", name: "Contacts", icon: Building2Icon },
  { href: "/leads", name: "Leads", icon: WorkflowIcon },
  { href: "/tasks", name: "Tasks", icon: CalendarClockIcon },
  {
    href: "/cadences",
    name: "Cadences",
    icon: Settings2Icon,
    managerOnly: true,
  },
  { href: "/team", name: "Team", icon: UsersRound, roles: ["admin", "manager"] },
  {
    href: "/reports",
    name: "Reports",
    icon: BarChart2Icon,
    roles: ["admin", "manager"],
  },
  {
    href: "/integrations",
    name: "Integrations",
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
          <div className="text-xs text-sidebar-foreground/70">Sales workspace</div>
        </div>
        {!hideCollapseOnMobile && (
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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
            if (i.roles) {
              return i.roles.includes(role as "admin" | "manager");
            }
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
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent/50",
                  active && "bg-sidebar-accent text-sidebar-foreground",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className={cn("truncate", collapsed && "sr-only")}>
                  {item.name}
                </span>
              </Link>
            );
          })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent/50",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground">
              {profile?.initials ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className={cn("min-w-0", collapsed && "sr-only")}>
            <div className="truncate text-sm font-medium">
              {profile?.displayName ?? profile?.email ?? "User"}
            </div>
            <div className="truncate text-xs text-sidebar-foreground/70">
              {profile?.role ?? ""}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  );
}

