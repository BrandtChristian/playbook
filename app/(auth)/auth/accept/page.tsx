"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // @supabase/ssr defaults to PKCE flow and ignores hash fragment tokens.
    // Magic links from admin.generateLink use implicit flow (#access_token=...).
    // We parse the hash manually and call setSession.
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          .then(({ error: sessionError }) => {
            if (!sessionError) {
              router.push("/");
            } else {
              console.error("setSession error:", sessionError);
              setError("Failed to sign you in. Please try logging in manually.");
            }
          });
        return;
      }
    }

    // Fallback: check if already signed in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.push("/");
      } else {
        setError("Unable to sign you in. The link may have expired.");
      }
    });
  }, [router]);

  if (error) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <a href="/login" className="text-sm text-primary underline">
          Go to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <CircleNotch className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  );
}
