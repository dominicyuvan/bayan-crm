"use client";

import * as React from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/lib/types";

const ALLOWED_DOMAIN = "@bayaninvestment.com";
const ADMIN_EMAILS = new Set([
  "dominic@bayaninvestment.com",
  "info@bayaninvestment.com",
]);

function getInitials(displayName: string, email: string) {
  const base = displayName?.trim() ? displayName.trim() : email.split("@")[0]!;
  const parts = base
    .replace(/[._-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}

async function resolveUserRole(user: User): Promise<UserRole> {
  const email = (user.email ?? "").toLowerCase();
  if (ADMIN_EMAILS.has(email)) return "admin";

  const memberRef = doc(db, "team_members", user.uid);
  const snap = await getDoc(memberRef);
  if (snap.exists()) {
    const data = snap.data() as { role?: string | null } | undefined;
    const rawRole = data?.role ?? null;
    if (rawRole === "admin") return "admin";
    if (rawRole === "manager") return "manager";
    if (rawRole === "sales_executive" || rawRole === "agent") return "agent";
  }

  return "agent";
}

async function upsertTeamMemberProfile(user: User) {
  const email = (user.email ?? "").toLowerCase();
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    await signOut(auth);
    throw new Error("Only @bayaninvestment.com accounts are allowed");
  }

  const displayName =
    user.displayName?.trim() || email.split("@")[0] || "Bayan User";

  const initials = getInitials(displayName, email);
  const role = await resolveUserRole(user);

  // Note: we store profile in `team_members/{uid}` for simplicity.
  const ref = doc(db, "team_members", user.uid);
  await setDoc(
    ref,
    {
      uid: user.uid,
      email,
      displayName,
      initials,
      role,
      isActive: true,
      status: "active",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    },
    { merge: true }
  );

  const profile: UserProfile = {
    uid: user.uid,
    email,
    displayName,
    initials,
    role,
    createdAt: serverTimestamp() as unknown as Timestamp,
    lastLoginAt: serverTimestamp() as unknown as Timestamp,
  };
  return profile;
}

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        setUser(u);
        if (!u) {
          setProfile(null);
          return;
        }
        const p = await upsertTeamMemberProfile(u);
        setProfile(p);
      } catch (e) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = React.useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    await upsertTeamMemberProfile(res.user);
  }, []);

  const signInWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await upsertTeamMemberProfile(res.user);
    },
    []
  );

  const signUpWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      await upsertTeamMemberProfile(res.user);
    },
    []
  );

  const doSignOut = React.useCallback(async () => {
    await signOut(auth);
  }, []);

  const value: AuthContextValue = React.useMemo(
    () => ({
      user,
      profile,
      role: profile?.role ?? null,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut: doSignOut,
    }),
    [user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, doSignOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

