"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  UsersIcon,
  TargetIcon,
  CheckSquareIcon,
  PlusIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogActivity } from "@/lib/log-activity-context";

const tabs = [
  { href: "/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/contacts", label: "Contacts", icon: UsersIcon },
  { href: "/leads", label: "Leads", icon: TargetIcon },
  { href: "/tasks", label: "Tasks", icon: CheckSquareIcon },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const { setOpen } = useLogActivity();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background pb-safe md:hidden">
      <div className="flex items-end justify-around px-2 pt-2 pb-1">
        {tabs.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-muted-foreground transition-colors active:bg-muted"
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              <span className={cn("text-[10px] font-medium", active && "text-primary")}>
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-mb-2 flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
          aria-label="Log activity"
        >
          <PlusIcon className="size-6" />
        </button>

        {tabs.slice(2, 4).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 py-2 text-muted-foreground transition-colors active:bg-muted"
            >
              <Icon className={cn("size-5", active && "text-primary")} />
              <span className={cn("text-[10px] font-medium", active && "text-primary")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
