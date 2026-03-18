"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6">
          <div className="text-lg font-semibold tracking-tight">Bayan CRM</div>
          <div className="text-sm text-muted-foreground">
            Only <span className="font-medium">@bayaninvestment.com</span>{" "}
            accounts are allowed.
          </div>
        </div>

        <Card className="p-5">
          <form onSubmit={onEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@bayaninvestment.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit" disabled={submitting}>
              Sign in
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="text-xs text-muted-foreground">or</div>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            className="w-full"
            variant="outline"
            onClick={onGoogle}
            disabled={submitting}
          >
            Continue with Google
          </Button>
        </Card>
      </div>
    </div>
  );
}

