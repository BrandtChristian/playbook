"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CircleNotch, CheckCircle } from "@phosphor-icons/react";

export function UnsubscribePage({
  token,
  contactEmail,
  orgName,
  brandConfig,
  consentTypeIds,
  readOnly = false,
}: {
  token: string;
  contactEmail: string;
  orgName: string;
  brandConfig?: { primary_color?: string; header_bg_color?: string } | null;
  consentTypeIds: string[];
  readOnly?: boolean;
}) {
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [done, setDone] = useState(false);

  const primaryColor = brandConfig?.primary_color || "#6366f1";
  const headerBg = brandConfig?.header_bg_color || primaryColor;

  async function handleUnsubscribe() {
    setUnsubscribing(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          consents: consentTypeIds.map((id) => ({
            consent_type_id: id,
            granted: false,
          })),
        }),
      });

      if (res.ok) {
        setDone(true);
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to unsubscribe");
      }
    } catch {
      toast.error("Failed to unsubscribe");
    } finally {
      setUnsubscribing(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div
          className="rounded-t-lg px-6 py-4"
          style={{ backgroundColor: headerBg }}
        >
          <h1 className="text-lg font-bold text-white">{orgName}</h1>
        </div>

        {/* Content */}
        <Card className="rounded-t-none">
          <CardHeader>
            {readOnly && (
              <div className="text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-md mb-2">
                Preview mode &mdash; this is what contacts see
              </div>
            )}
            <CardTitle className="text-base">
              {done ? "You\u2019ve been unsubscribed" : "Unsubscribe"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {done ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                  <CheckCircle
                    className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0"
                    weight="fill"
                  />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Successfully unsubscribed
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                      <strong>{contactEmail}</strong> will no longer receive
                      emails from {orgName}.
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Changed your mind?{" "}
                  <a
                    href={`/preferences/${token}`}
                    className="underline hover:text-foreground transition-colors"
                    style={{ color: primaryColor }}
                  >
                    Manage your preferences
                  </a>{" "}
                  to re-subscribe to specific emails.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Unsubscribe <strong>{contactEmail}</strong> from all emails
                  sent by {orgName}?
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleUnsubscribe}
                    disabled={unsubscribing || readOnly}
                    variant="destructive"
                  >
                    {unsubscribing ? (
                      <>
                        <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                        Unsubscribing...
                      </>
                    ) : (
                      "Confirm unsubscribe"
                    )}
                  </Button>
                  <a
                    href={`/preferences/${token}`}
                    className="text-sm text-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Or manage individual preferences instead
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by {orgName}
        </p>
      </div>
    </div>
  );
}
