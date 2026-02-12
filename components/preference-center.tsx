"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";

type ConsentType = {
  id: string;
  name: string;
  description: string | null;
};

type ConsentRecord = {
  consent_type_id: string;
  granted: boolean;
};

export function PreferenceCenter({
  token,
  contactEmail,
  orgName,
  brandConfig,
  consentTypes,
  currentConsents,
}: {
  token: string;
  contactEmail: string;
  orgName: string;
  brandConfig?: { primary_color?: string; header_bg_color?: string } | null;
  consentTypes: ConsentType[];
  currentConsents: ConsentRecord[];
}) {
  const [consents, setConsents] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const ct of consentTypes) {
      const existing = currentConsents.find((c) => c.consent_type_id === ct.id);
      map[ct.id] = existing ? existing.granted : true;
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const primaryColor = brandConfig?.primary_color || "#6366f1";

  function toggleConsent(id: string) {
    setConsents((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  function handleUnsubscribeAll() {
    const allOff: Record<string, boolean> = {};
    for (const ct of consentTypes) {
      allOff[ct.id] = false;
    }
    setConsents(allOff);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          consents: Object.entries(consents).map(([consent_type_id, granted]) => ({
            consent_type_id,
            granted,
          })),
        }),
      });

      if (res.ok) {
        setSaved(true);
        toast.success("Preferences saved");
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to save preferences");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div
          className="rounded-t-lg px-6 py-4"
          style={{ backgroundColor: brandConfig?.header_bg_color || primaryColor }}
        >
          <h1 className="text-lg font-bold text-white">{orgName}</h1>
        </div>

        {/* Content */}
        <Card className="rounded-t-none">
          <CardHeader>
            <CardTitle className="text-base">Email Preferences</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your email preferences for <strong>{contactEmail}</strong>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {consentTypes.map((ct) => (
              <label
                key={ct.id}
                className="flex items-start gap-3 cursor-pointer p-3 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={consents[ct.id] ?? false}
                  onCheckedChange={() => toggleConsent(ct.id)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{ct.name}</p>
                  {ct.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ct.description}
                    </p>
                  )}
                </div>
              </label>
            ))}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: primaryColor }}
              >
                {saving ? (
                  <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : saved ? (
                  "Saved!"
                ) : (
                  "Save preferences"
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleUnsubscribeAll}
              >
                Unsubscribe from all
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by {orgName}
        </p>
      </div>
    </div>
  );
}
