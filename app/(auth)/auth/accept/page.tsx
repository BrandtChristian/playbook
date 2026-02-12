"use client";

import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch } from "@phosphor-icons/react";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Verify the magic link token via verifyOtp.
    // We use token_hash (query param) instead of the Supabase /auth/v1/verify
    // endpoint to avoid email link scanners (e.g. Outlook SafeLinks)
    // consuming the one-time token before the real user clicks.
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (tokenHash && type === "magiclink") {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "magiclink" })
        .then(({ error: otpError }) => {
          if (!otpError) {
            router.push("/");
          } else {
            console.error("verifyOtp error:", otpError);
            setError(
              "Failed to sign you in. The link may have expired — ask your admin to resend the invite."
            );
          }
        });
      return;
    }

    // Legacy fallback: handle hash fragment tokens from old-style links
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
              setError(
                "Failed to sign you in. Please try logging in manually."
              );
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
  }, [router, searchParams]);

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

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-3">
          <CircleNotch className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Signing you in...</p>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
