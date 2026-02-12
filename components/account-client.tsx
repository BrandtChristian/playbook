"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import type { Profile } from "@/lib/auth/dal";

export function AccountClient({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [jobTitle, setJobTitle] = useState(profile.job_title || "");
  const [testEmail, setTestEmail] = useState(
    profile.preferred_test_email || ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        job_title: jobTitle.trim() || null,
        preferred_test_email: testEmail.trim() || null,
      })
      .eq("id", profile.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated");
      router.refresh();
    }
  }

  const initial = (fullName || "?")[0]?.toUpperCase() || "?";

  return (
    <form onSubmit={handleSave} className="max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-primary/10 text-primary font-bold">
              {initial}
            </div>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your personal details and preferences.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="acct-name">Full name</Label>
            <Input
              id="acct-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acct-job">Job title</Label>
            <Input
              id="acct-job"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Marketing Manager"
            />
            <p className="text-xs text-muted-foreground">
              Helps us tailor playbook recommendations.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acct-test-email">Preferred test email</Label>
            <Input
              id="acct-test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <p className="text-xs text-muted-foreground">
              Test sends will be delivered to this address by default.
            </p>
          </div>
          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? (
              <>
                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
