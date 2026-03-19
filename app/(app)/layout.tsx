"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-context";
import { ShellLayout } from "@/components/shell-layout";
import { LogActivityControlProvider } from "@/lib/log-activity-control-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="flex min-h-dvh flex-col">
          <div className="border-b p-4">
            <Skeleton className="h-9 w-full max-w-lg" />
          </div>
          <div className="p-6">
            <Skeleton className="h-28 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <LogActivityControlProvider>
        <ShellLayout>{children}</ShellLayout>
        <Toaster richColors closeButton />
      </LogActivityControlProvider>
    </>
  );
}

