"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, Camera, Lock, LogOut, Save, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firestore";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { profile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [firstName, setFirstName] = useState(profile?.firstName || "");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [emailDigest, setEmailDigest] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName || "");
    setFirstName(profile?.firstName || "");
  }, [profile?.displayName, profile?.firstName]);

  const getTeamMemberDoc = async () => {
    if (!profile?.email) return null;
    const snap = await getDocs(
      query(
        collection(db, "team_members"),
        where("email", "==", profile.email.toLowerCase())
      )
    );
    return snap.empty ? null : snap.docs[0];
  };

  useEffect(() => {
    async function loadMember() {
      try {
        const memberDoc = await getTeamMemberDoc();
        if (!memberDoc) return;
        const data = memberDoc.data() as any;
        setPhone((data?.phone as string) || "");
        setJobTitle((data?.jobTitle as string) || "");
        setPhotoURL((data?.photoURL as string) || photoURL);
        const prefs = (data?.preferences as any) || {};
        setEmailDigest(prefs.emailDigest !== false);
        setWeeklyReport(prefs.weeklyReport !== false);
      } catch {
        // ignore
      }
    }
    void loadMember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email]);

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Import Firebase Storage
      const { ref, uploadBytes, getDownloadURL } = await import(
        "firebase/storage"
      );
      const { storage } = await import("@/lib/firebase");

      // Upload to Firebase Storage
      const storageRef = ref(
        storage,
        `profile-photos/${auth.currentUser.uid}`
      );
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, { photoURL: downloadURL });

      // Update Firestore team_members
      const memberDoc = await getTeamMemberDoc();
      if (memberDoc) {
        await updateDoc(doc(db, "team_members", memberDoc.id), {
          photoURL: downloadURL,
        });
      }

      setPhotoURL(downloadURL);
      toast.success("Profile photo updated ✓");
    } catch (err: any) {
      console.error("Photo upload error:", err);
      if (err?.code === "storage/unauthorized") {
        toast.error(
          "Permission denied — enable Firebase Storage in console"
        );
      } else {
        toast.error(`Failed to upload photo: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setIsUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.uid) return;
    setIsSavingProfile(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName });
      }

      await updateDoc(doc(db, "team_members", profile.uid), {
        name: displayName,
        displayName,
        firstName,
        phone,
        jobTitle,
      });

      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(`Failed to update profile: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword || !currentPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (!auth.currentUser || !profile?.email) throw new Error("Not logged in");
      const credential = EmailAuthProvider.credential(profile.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err?.code === "auth/wrong-password") {
        toast.error("Current password is incorrect");
      } else {
        toast.error(`Failed to update password: ${err?.message || "Unknown error"}`);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!profile?.uid) return;
    setIsSavingPrefs(true);
    try {
      await updateDoc(doc(db, "team_members", profile.uid), {
        preferences: {
          emailDigest,
          weeklyReport,
        },
      });
      toast.success("Preferences saved");
    } catch (err: any) {
      toast.error(`Failed to save preferences: ${err?.message || "Unknown error"}`);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const initials =
    profile?.initials ||
    profile?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() ||
    "U";

  const roleLabel =
    profile?.role === "admin"
      ? "Admin"
      : profile?.role === "manager"
      ? "Manager"
      : "Sales Executive";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your name and contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoURL || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() =>
                  !isUploadingPhoto && fileInputRef.current?.click()
                }
                disabled={isUploadingPhoto}
                className={cn(
                  "absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90",
                  "disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                )}
              >
                {isUploadingPhoto ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <p className="text-lg font-semibold">{profile?.displayName}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <Badge className="mt-1 border-0 bg-primary/10 text-xs text-primary">
                {roleLabel}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+968 9XXX XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label>Job Title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Sales Executive"
              />
            </div>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={isSavingProfile}
            className="w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSavingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4 text-primary" />
            Login Details
          </CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Address</Label>
            <Input value={profile?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <Button
            onClick={handleUpdatePassword}
            disabled={isUpdatingPassword}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Lock className="mr-2 h-4 w-4" />
            {isUpdatingPassword ? "Updating..." : "Update Password"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Email Preferences
          </CardTitle>
          <CardDescription>Choose which emails you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Daily Digest</p>
              <p className="text-xs text-muted-foreground">
                Morning summary of your activities — 9am daily
              </p>
            </div>
            <Switch checked={emailDigest} onCheckedChange={setEmailDigest} />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Weekly Report</p>
              <p className="text-xs text-muted-foreground">
                Team performance summary every Thursday
              </p>
            </div>
            <Switch checked={weeklyReport} onCheckedChange={setWeeklyReport} />
          </div>

          <Button
            onClick={handleSavePreferences}
            disabled={isSavingPrefs}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {isSavingPrefs ? "Saving..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="destructive" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

