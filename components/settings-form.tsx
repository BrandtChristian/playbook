"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  CircleNotch,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Globe,
} from "@phosphor-icons/react";

type Org = {
  id: string;
  name: string;
  resend_api_key: string | null;
  from_email: string | null;
  from_name: string | null;
  domain_verified: boolean;
};

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  region: string;
};

function domainStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return (
        <Badge className="gap-1">
          <CheckCircle className="h-3 w-3" weight="fill" />
          Verified
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary" className="gap-1">
          <CircleNotch className="h-3 w-3 animate-spin" />
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <WarningCircle className="h-3 w-3" />
          {status.replace(/_/g, " ")}
        </Badge>
      );
  }
}

export function SettingsForm({ org }: { org: Org }) {
  const [name, setName] = useState(org.name);
  const [apiKey, setApiKey] = useState(org.resend_api_key ?? "");
  const [fromName, setFromName] = useState(org.from_name ?? "");
  const [fromPrefix, setFromPrefix] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");
  const [domains, setDomains] = useState<ResendDomain[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const router = useRouter();

  // Parse existing from_email into prefix + domain
  useEffect(() => {
    if (org.from_email) {
      const [prefix, domain] = org.from_email.split("@");
      if (prefix && domain) {
        setFromPrefix(prefix);
        setSelectedDomain(domain);
      }
    }
  }, [org.from_email]);

  // Auto-fetch domains if API key is already saved
  useEffect(() => {
    if (org.resend_api_key) {
      fetchDomains();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDomains() {
    setLoadingDomains(true);
    try {
      const res = await fetch("/api/resend/domains");
      const json = await res.json();
      if (res.ok) {
        setDomains(json.domains);
      } else {
        toast.error(json.error || "Failed to fetch domains");
      }
    } catch {
      toast.error("Failed to connect to Resend");
    } finally {
      setLoadingDomains(false);
    }
  }

  async function handleConnect() {
    if (!apiKey.trim()) {
      toast.error("Enter a Resend API key");
      return;
    }

    setConnecting(true);
    const supabase = createClient();

    // Save the API key first
    const { error } = await supabase
      .from("organizations")
      .update({ resend_api_key: apiKey.trim() })
      .eq("id", org.id);

    if (error) {
      toast.error("Failed to save API key");
      setConnecting(false);
      return;
    }

    // Now fetch domains to validate the key
    try {
      const res = await fetch("/api/resend/domains");
      const json = await res.json();
      if (res.ok) {
        setDomains(json.domains);
        toast.success(
          `Connected! Found ${json.domains.length} domain${json.domains.length !== 1 ? "s" : ""}.`
        );
        router.refresh();
      } else {
        toast.error(json.error || "Invalid API key or Resend error");
        // Revert the key if it's invalid
        await supabase
          .from("organizations")
          .update({ resend_api_key: org.resend_api_key })
          .eq("id", org.id);
      }
    } catch {
      toast.error("Failed to validate API key");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    const supabase = createClient();
    await supabase
      .from("organizations")
      .update({
        resend_api_key: null,
        from_email: null,
        from_name: null,
        domain_verified: false,
      })
      .eq("id", org.id);

    setApiKey("");
    setDomains([]);
    setSelectedDomain("");
    setFromPrefix("");
    setFromName("");
    toast.success("Disconnected from Resend");
    router.refresh();
  }

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrg(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("organizations")
      .update({ name })
      .eq("id", org.id);

    setSavingOrg(false);
    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Organization updated");
      router.refresh();
    }
  }

  async function handleSaveSender(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDomain) {
      toast.error("Select a sending domain first");
      return;
    }

    const fromEmail = `${fromPrefix || "hello"}@${selectedDomain}`;
    const verified =
      domains.find((d) => d.name === selectedDomain)?.status === "verified";

    setSavingSender(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("organizations")
      .update({
        from_email: fromEmail,
        from_name: fromName || null,
        domain_verified: verified,
      })
      .eq("id", org.id);

    setSavingSender(false);
    if (error) {
      toast.error("Failed to save sender settings");
    } else {
      toast.success("Sender settings saved");
      router.refresh();
    }
  }

  const isConnected = org.resend_api_key && domains.length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Organization */}
      <form onSubmit={handleSaveOrg}>
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your company details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="orgName">Company name</Label>
              <Input
                id="orgName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={savingOrg}>
              {savingOrg ? "Saving..." : "Save"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Resend Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Sending</CardTitle>
              <CardDescription>
                Connect your Resend account to start sending emails.
              </CardDescription>
            </div>
            {isConnected ? (
              <Badge className="gap-1">
                <CheckCircle className="h-3 w-3" weight="fill" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="apiKey">Resend API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                placeholder="re_xxxxxxxxx"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={!!isConnected}
                className="flex-1"
              />
              {isConnected ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting || !apiKey.trim()}
                >
                  {connecting ? (
                    <>
                      <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from resend.com/api-keys
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Domains */}
      {org.resend_api_key && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Domains</CardTitle>
                <CardDescription>
                  Your verified sending domains from Resend.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchDomains}
                disabled={loadingDomains}
              >
                <ArrowsClockwise
                  className={`h-4 w-4 ${loadingDomains ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDomains ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <CircleNotch className="h-4 w-4 animate-spin" />
                Loading domains...
              </div>
            ) : domains.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">
                <p>No domains found in your Resend account.</p>
                <p className="mt-1">
                  Add a domain at{" "}
                  <a
                    href="https://resend.com/domains"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    resend.com/domains
                  </a>{" "}
                  and refresh.
                </p>
              </div>
            ) : (
              <div className="grid gap-2">
                {domains.map((domain) => (
                  <button
                    key={domain.id}
                    type="button"
                    onClick={() => setSelectedDomain(domain.name)}
                    className={`flex items-center justify-between p-3 border text-left transition-colors hover:bg-muted/50 ${
                      selectedDomain === domain.name
                        ? "border-primary bg-muted/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {domain.name}
                      </span>
                    </div>
                    {domainStatusBadge(domain.status)}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sender Settings — only shown when a domain is selected */}
      {selectedDomain && (
        <form onSubmit={handleSaveSender}>
          <Card>
            <CardHeader>
              <CardTitle>Sender Settings</CardTitle>
              <CardDescription>
                Configure the &ldquo;from&rdquo; address for your emails.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fromPrefix">From address</Label>
                <div className="flex items-center gap-0">
                  <Input
                    id="fromPrefix"
                    placeholder="hello"
                    value={fromPrefix}
                    onChange={(e) => setFromPrefix(e.target.value)}
                    className="rounded-r-none border-r-0"
                  />
                  <div className="flex items-center h-9 px-3 border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                    @{selectedDomain}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Emails will be sent from{" "}
                  <strong>
                    {fromPrefix || "hello"}@{selectedDomain}
                  </strong>
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fromName">Display name</Label>
                <Input
                  id="fromName"
                  placeholder={name || "Your Company"}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Recipients see this as the sender name.
                </p>
              </div>
              {domains.find((d) => d.name === selectedDomain)?.status !==
                "verified" && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-3 border border-amber-200 dark:border-amber-800">
                  <WarningCircle className="h-4 w-4 shrink-0" />
                  This domain is not verified yet. Verify it at
                  resend.com/domains before sending.
                </div>
              )}
              <Button type="submit" disabled={savingSender}>
                {savingSender ? "Saving..." : "Save sender settings"}
              </Button>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
