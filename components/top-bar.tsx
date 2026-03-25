"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { Bell, LogOutIcon, SearchIcon, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useContacts, useFirestore, useLeads, useTasks } from "@/lib/firestore-provider";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildNotifications } from "@/lib/notifications";

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
  const { activities } = useFirestore();
  const isMobile = useIsMobile();

  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [readIds, setReadIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("bayan_read_notifs");
      setReadIds(new Set(stored ? JSON.parse(stored) : []));
    } catch {
      setReadIds(new Set());
    }
  }, []);

  const notifications = React.useMemo(
    () =>
      buildNotifications(
        leads.items,
        tasks.items,
        activities.items,
        profile?.uid || "",
        profile?.role || "agent"
      ),
    [leads.items, tasks.items, activities.items, profile?.uid, profile?.role]
  );

  const unreadNotifications = React.useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)),
    [notifications, readIds]
  );
  const unreadCount = unreadNotifications.length;

  function persistRead(next: Set<string>) {
    setReadIds(next);
    try {
      window.localStorage.setItem("bayan_read_notifs", JSON.stringify([...next]));
    } catch {
      // ignore
    }
  }

  const markAllRead = React.useCallback(() => {
    const allIds = new Set(notifications.map((n) => n.id));
    persistRead(allIds);
  }, [notifications]);

  const markRead = React.useCallback(
    (id: string) => {
      const newIds = new Set([...readIds, id]);
      persistRead(newIds);
    },
    [readIds]
  );

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
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <button className="relative rounded-lg p-2 transition-colors hover:bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              className="w-80 rounded-2xl border border-border p-0 shadow-2xl"
              sideOffset={8}
            >
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-foreground" />
                    <span className="text-sm font-semibold">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">All caught up!</p>
                    <p className="text-xs text-muted-foreground/70">
                      No notifications right now
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const isRead = readIds.has(notif.id);
                    const icons = {
                      overdue_task: {
                        icon: "⏰",
                        bg: "bg-red-100",
                      },
                      lead_going_cold: {
                        icon: "🧊",
                        bg: "bg-blue-100",
                      },
                      deal_won: {
                        icon: "🏆",
                        bg: "bg-green-100",
                      },
                      leads_generated: {
                        icon: "✨",
                        bg: "bg-purple-100",
                      },
                      never_contacted: {
                        icon: "👤",
                        bg: "bg-amber-100",
                      },
                    } as const;
                    const iconConfig = icons[notif.type];

                    return (
                      <button
                        key={notif.id}
                        onClick={() => {
                          markRead(notif.id);
                          setNotifOpen(false);
                          window.location.href = notif.href;
                        }}
                        className={cn(
                          "w-full border-b border-border/50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                          "flex items-start gap-3",
                          !isRead && "bg-primary/5"
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-base",
                            iconConfig.bg
                          )}
                        >
                          {iconConfig.icon}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <p
                              className={cn(
                                "truncate text-sm",
                                !isRead
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-muted-foreground"
                              )}
                            >
                              {notif.title}
                            </p>
                            {!isRead && (
                              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {notif.description}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      window.location.href = "/leads";
                    }}
                    className="w-full text-center text-xs text-primary hover:underline"
                  >
                    View all leads →
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>

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
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="mr-2 size-4" />
                My Profile
              </DropdownMenuItem>
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

