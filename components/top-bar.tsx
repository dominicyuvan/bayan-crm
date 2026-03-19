"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { BellIcon, LogOutIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useLeads, useTasks } from "@/lib/firestore-provider";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SearchResult =
  | { type: "contact"; id: string; title: string; subtitle?: string }
  | { type: "lead"; id: string; title: string; subtitle?: string };

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const showSearchDropdown = pathname !== "/dashboard";

  const contacts = useContacts();
  const leads = useLeads();
  const tasks = useTasks();
  const isMobile = useIsMobile();

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const overdueCount = React.useMemo(() => {
    return tasks.items.filter((t) => t.isOverdue).length;
  }, [tasks.items]);

  const results = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];

    const contactResults: SearchResult[] = contacts.items
      .filter((c) => {
        const name = `${c.firstName} ${c.lastName}`.toLowerCase();
        const phone = (c.phone ?? "").toLowerCase();
        const company = (c.company ?? "").toLowerCase();
        return (
          name.includes(query) ||
          phone.includes(query) ||
          company.includes(query)
        );
      })
      .slice(0, 5)
      .map((c) => ({
        type: "contact",
        id: c.id,
        title: `${c.firstName} ${c.lastName}`.trim(),
        subtitle: c.company || c.phone,
      }));

    const leadResults: SearchResult[] = leads.items
      .filter((l) => {
        const loc = (l.location ?? "").toLowerCase();
        const pt = (l.propertyType ?? "").toLowerCase();
        return loc.includes(query) || pt.includes(query);
      })
      .slice(0, 5)
      .map((l) => ({
        type: "lead",
        id: l.id,
        title: `${l.propertyType ?? "Lead"} • ${l.location ?? "—"}`,
        subtitle: l.status,
      }));

    return [...contactResults, ...leadResults].slice(0, 8);
  }, [q, contacts.items, leads.items]);

  function goToResult(r: SearchResult) {
    setOpen(false);
    setQ("");
    if (r.type === "contact") router.push("/contacts");
    if (r.type === "lead") router.push("/leads");
  }

  async function onSignOut() {
    try {
      await signOut();
      router.replace("/login");
    } catch (e) {
      toast.error("Failed to sign out");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {isMobile ? (
          <div className="text-base font-semibold tracking-tight">
            Bayan CRM
          </div>
        ) : (
          <div className="relative w-full max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search contacts & leads..."
              className="pl-9"
            />
            {showSearchDropdown && open && results.length > 0 && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] rounded-xl border bg-popover p-1 shadow-lg">
                {results.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => goToResult(r)}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.title}</div>
                      {r.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">
                          {r.subtitle}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            className="relative min-h-[44px]"
            onClick={() => router.push("/tasks")}
          >
            <BellIcon className="size-4" />
            {overdueCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {overdueCount}
              </span>
            )}
            <span className="sr-only">Overdue tasks</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full min-h-[44px]"
              >
                <Avatar className="size-8">
                  <AvatarFallback>
                    {profile?.initials ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSignOut}>
                <LogOutIcon className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

