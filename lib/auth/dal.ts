import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  org_id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  preferred_test_email: string | null;
  role: "owner" | "admin" | "member";
  created_at: string;
  seen_flows: Record<string, string>;
  organizations: {
    id: string;
    name: string;
    resend_api_key: string | null;
    from_email: string | null;
    from_name: string | null;
    domain_verified: boolean;
    onboarding_completed: boolean;
    brand_config: Record<string, unknown> | null;
    email_provider: "resend" | "agillic";
    agillic_credentials: {
      staging_key: string;
      staging_secret: string;
      prod_key: string;
      prod_secret: string;
      instance_url: string;
    } | null;
    created_at: string;
  };
};

export const getCurrentUser = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (error || !profile) redirect("/login");

  return profile as Profile;
});

export const requireAdmin = cache(async (): Promise<Profile> => {
  const profile = await getCurrentUser();
  if (profile.role === "member") {
    redirect("/");
  }
  return profile;
});
