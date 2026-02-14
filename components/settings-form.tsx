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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CircleNotch,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  Globe,
  Plus,
  PencilSimple,
  ShieldCheck,
  Eye,
} from "@phosphor-icons/react";

type Org = {
  id: string;
  name: string;
  resend_api_key: string | null;
  from_email: string | null;
  from_name: string | null;
  domain_verified: boolean;
  email_provider: "resend" | "agillic";
  agillic_credentials: {
    staging_key: string;
    staging_secret: string;
    staging_url: string;
    prod_key: string;
    prod_secret: string;
    prod_url: string;
  } | null;
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

type ConsentType = {
  id: string;
  name: string;
  description: string | null;
  legal_text: string | null;
  is_active: boolean;
  version: number;
};

export function SettingsForm({
  org,
  consentTypes: initialConsentTypes,
}: {
  org: Org;
  consentTypes: ConsentType[];
}) {
  const [name, setName] = useState(org.name);
  const [emailProvider, setEmailProvider] = useState<"resend" | "agillic">(org.email_provider ?? "resend");
  const [apiKey, setApiKey] = useState(org.resend_api_key ?? "");
  const [fromName, setFromName] = useState(org.from_name ?? "");
  const [fromPrefix, setFromPrefix] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("");

  // Agillic credentials state
  const [agillicStagingKey, setAgillicStagingKey] = useState(org.agillic_credentials?.staging_key ?? "");
  const [agillicStagingSecret, setAgillicStagingSecret] = useState(org.agillic_credentials?.staging_secret ?? "");
  const [agillicProdKey, setAgillicProdKey] = useState(org.agillic_credentials?.prod_key ?? "");
  const [agillicProdSecret, setAgillicProdSecret] = useState(org.agillic_credentials?.prod_secret ?? "");
  const [agillicStagingUrl, setAgillicStagingUrl] = useState(org.agillic_credentials?.staging_url ?? "");
  const [agillicProdUrl, setAgillicProdUrl] = useState(org.agillic_credentials?.prod_url ?? "");
  const [testingAgillic, setTestingAgillic] = useState(false);
  const [agillicConnected, setAgillicConnected] = useState(!!org.agillic_credentials?.staging_key);
  const [savingAgillic, setSavingAgillic] = useState(false);
  const [syncingTargetGroups, setSyncingTargetGroups] = useState(false);
  const [agillicWebdavUser, setAgillicWebdavUser] = useState(
    (org.agillic_credentials as Record<string, string> | null)?.webdav_username ?? ""
  );
  const [agillicWebdavPass, setAgillicWebdavPass] = useState(
    (org.agillic_credentials as Record<string, string> | null)?.webdav_password ?? ""
  );
  const [agillicWebdavPath, setAgillicWebdavPath] = useState(
    (org.agillic_credentials as Record<string, string> | null)?.webdav_path ?? "/bcmportlet/webdav/bcm/media/templates/email/Bifrost/"
  );
  const [syncingTemplates, setSyncingTemplates] = useState(false);

  // Consent types state
  const [consentTypes, setConsentTypes] = useState<ConsentType[]>(initialConsentTypes);
  const [newConsentName, setNewConsentName] = useState("");
  const [newConsentDesc, setNewConsentDesc] = useState("");
  const [newConsentLegal, setNewConsentLegal] = useState("");
  const [addingConsent, setAddingConsent] = useState(false);
  const [editingConsent, setEditingConsent] = useState<ConsentType | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editLegal, setEditLegal] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [versionHistory, setVersionHistory] = useState<
    Record<string, { version: number; legal_text: string | null; created_at: string }[]>
  >({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
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

  async function toggleVersionHistory(consentTypeId: string) {
    if (expandedHistory === consentTypeId) {
      setExpandedHistory(null);
      return;
    }
    setExpandedHistory(consentTypeId);
    if (!versionHistory[consentTypeId]) {
      setLoadingHistory(consentTypeId);
      const supabase = createClient();
      const { data } = await supabase
        .from("consent_type_versions")
        .select("version, legal_text, created_at")
        .eq("consent_type_id", consentTypeId)
        .order("version", { ascending: false });
      setVersionHistory((prev) => ({
        ...prev,
        [consentTypeId]: data ?? [],
      }));
      setLoadingHistory(null);
    }
  }

  async function handleSaveEdit() {
    if (!editingConsent) return;
    setSavingEdit(true);
    const supabase = createClient();
    const legalChanged = editLegal.trim() !== (editingConsent.legal_text ?? "");
    const newVersion = legalChanged ? editingConsent.version + 1 : editingConsent.version;

    if (legalChanged) {
      // Snapshot current version before updating
      await supabase.from("consent_type_versions").insert({
        consent_type_id: editingConsent.id,
        version: editingConsent.version,
        name: editingConsent.name,
        description: editingConsent.description,
        legal_text: editingConsent.legal_text,
      });
    }

    const { error } = await supabase
      .from("consent_types")
      .update({
        name: editName.trim(),
        description: editDesc.trim() || null,
        legal_text: editLegal.trim() || null,
        version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingConsent.id);

    setSavingEdit(false);
    if (error) {
      toast.error("Failed to update consent type");
    } else {
      setConsentTypes(
        consentTypes.map((c) =>
          c.id === editingConsent.id
            ? {
                ...c,
                name: editName.trim(),
                description: editDesc.trim() || null,
                legal_text: editLegal.trim() || null,
                version: newVersion,
              }
            : c
        )
      );
      setEditingConsent(null);
      toast.success(legalChanged ? `Updated to v${newVersion}` : "Updated");
    }
  }

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

      {/* Email Provider Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Email Provider</CardTitle>
          <CardDescription>
            Choose your email sending infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={async () => {
                setEmailProvider("resend");
                const supabase = createClient();
                await supabase
                  .from("organizations")
                  .update({ email_provider: "resend" })
                  .eq("id", org.id);
                router.refresh();
              }}
              className={`flex flex-col items-start gap-1 p-4 border text-left transition-colors hover:bg-muted/50 ${
                emailProvider === "resend" ? "border-primary bg-muted/30" : ""
              }`}
            >
              <span className="font-medium text-sm">Resend</span>
              <span className="text-xs text-muted-foreground">
                Direct email sending via Resend API
              </span>
            </button>
            <button
              type="button"
              onClick={async () => {
                setEmailProvider("agillic");
                const supabase = createClient();
                await supabase
                  .from("organizations")
                  .update({ email_provider: "agillic" })
                  .eq("id", org.id);
                router.refresh();
              }}
              className={`flex flex-col items-start gap-1 p-4 border text-left transition-colors hover:bg-muted/50 ${
                emailProvider === "agillic" ? "border-primary bg-muted/30" : ""
              }`}
            >
              <span className="font-medium text-sm">Agillic</span>
              <span className="text-xs text-muted-foreground">
                Enterprise marketing via Agillic platform
              </span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Agillic Connection */}
      {emailProvider === "agillic" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Agillic Connection</CardTitle>
                <CardDescription>
                  Connect your Agillic instance to start sending campaigns.
                </CardDescription>
              </div>
              {agillicConnected ? (
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
              <Label htmlFor="agillicCompanyId">Agillic Company ID</Label>
              <Input
                id="agillicCompanyId"
                placeholder="e.g. acme"
                onChange={(e) => {
                  const id = e.target.value.trim().toLowerCase();
                  if (id) {
                    setAgillicStagingUrl(`https://${id}-stag.agillic.eu`);
                    setAgillicProdUrl(`https://${id}-prod.agillic.eu`);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Auto-fills staging and production URLs. Edit below to override.
              </p>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staging Environment</p>
            <div className="grid gap-2">
              <Label htmlFor="agillicStagingUrl">Staging URL</Label>
              <Input id="agillicStagingUrl" placeholder="https://customer-stag.agillic.eu" value={agillicStagingUrl} onChange={(e) => setAgillicStagingUrl(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="agillicStagingKey">Staging Key</Label>
                <Input id="agillicStagingKey" placeholder="Developer key" value={agillicStagingKey} onChange={(e) => setAgillicStagingKey(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agillicStagingSecret">Staging Secret</Label>
                <Input id="agillicStagingSecret" type="password" placeholder="Developer secret" value={agillicStagingSecret} onChange={(e) => setAgillicStagingSecret(e.target.value)} />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Production Environment</p>
            <div className="grid gap-2">
              <Label htmlFor="agillicProdUrl">Production URL</Label>
              <Input id="agillicProdUrl" placeholder="https://customer-prod.agillic.eu" value={agillicProdUrl} onChange={(e) => setAgillicProdUrl(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="agillicProdKey">Production Key</Label>
                <Input id="agillicProdKey" placeholder="Developer key" value={agillicProdKey} onChange={(e) => setAgillicProdKey(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="agillicProdSecret">Production Secret</Label>
                <Input id="agillicProdSecret" type="password" placeholder="Developer secret" value={agillicProdSecret} onChange={(e) => setAgillicProdSecret(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="agillicFromName">Sender name</Label>
              <Input id="agillicFromName" placeholder={name || "Your Company"} value={fromName} onChange={(e) => setFromName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={testingAgillic || !agillicStagingKey || !agillicStagingSecret}
                onClick={async () => {
                  setTestingAgillic(true);
                  const results: string[] = [];
                  let allOk = true;
                  try {
                    // Test staging
                    const stagRes = await fetch("/api/agillic/validate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ api_key: agillicStagingKey, api_secret: agillicStagingSecret, instance_url: agillicStagingUrl }),
                    });
                    if (stagRes.ok) { results.push("Staging OK"); }
                    else { results.push("Staging FAILED"); allOk = false; }

                    // Test production (if credentials provided)
                    if (agillicProdKey && agillicProdSecret) {
                      const prodRes = await fetch("/api/agillic/validate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ api_key: agillicProdKey, api_secret: agillicProdSecret, instance_url: agillicProdUrl }),
                      });
                      if (prodRes.ok) { results.push("Production OK"); }
                      else { results.push("Production FAILED"); allOk = false; }
                    }

                    if (allOk) {
                      toast.success(results.join(" / "));
                      setAgillicConnected(true);
                    } else {
                      toast.error(results.join(" / "));
                    }
                  } catch { toast.error("Connection test failed"); }
                  finally { setTestingAgillic(false); }
                }}
              >
                {testingAgillic ? (<><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Testing...</>) : "Test Connection"}
              </Button>
              <Button
                type="button"
                disabled={savingAgillic || !agillicStagingKey || !agillicStagingSecret || !agillicStagingUrl}
                onClick={async () => {
                  setSavingAgillic(true);
                  const supabase = createClient();
                  const { error } = await supabase
                    .from("organizations")
                    .update({
                      agillic_credentials: {
                        staging_key: agillicStagingKey,
                        staging_secret: agillicStagingSecret,
                        staging_url: agillicStagingUrl,
                        prod_key: agillicProdKey,
                        prod_secret: agillicProdSecret,
                        prod_url: agillicProdUrl,
                        webdav_username: agillicWebdavUser || undefined,
                        webdav_password: agillicWebdavPass || undefined,
                        webdav_path: agillicWebdavPath || undefined,
                      },
                      from_name: fromName || null,
                    })
                    .eq("id", org.id);
                  setSavingAgillic(false);
                  if (error) { toast.error("Failed to save"); }
                  else { toast.success("Agillic settings saved"); setAgillicConnected(true); router.refresh(); }
                }}
              >
                {savingAgillic ? "Saving..." : "Save Agillic Settings"}
              </Button>
            </div>
            {agillicConnected && agillicProdKey && (
              <div className="border-t pt-4 mt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Target Groups</p>
                    <p className="text-xs text-muted-foreground">Sync from Agillic to see available target groups.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={syncingTargetGroups}
                    onClick={async () => {
                      setSyncingTargetGroups(true);
                      try {
                        const res = await fetch("/api/agillic/sync-target-groups", { method: "POST" });
                        const json = await res.json();
                        if (res.ok) { toast.success(json.message); }
                        else { toast.error(json.error || "Sync failed"); }
                      } catch { toast.error("Sync failed"); }
                      finally { setSyncingTargetGroups(false); }
                    }}
                  >
                    {syncingTargetGroups ? (<><CircleNotch className="mr-2 h-3 w-3 animate-spin" />Syncing...</>) : (<><ArrowsClockwise className="mr-1 h-3 w-3" />Sync Target Groups</>)}
                  </Button>
                </div>
              </div>
            )}
            {agillicConnected && (
              <div className="border-t pt-4 mt-2 grid gap-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">WebDAV (Template Sync)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="webdavUser">WebDAV Username</Label>
                    <Input id="webdavUser" placeholder="Username" value={agillicWebdavUser} onChange={(e) => setAgillicWebdavUser(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="webdavPass">WebDAV Password</Label>
                    <Input id="webdavPass" type="password" placeholder="Password" value={agillicWebdavPass} onChange={(e) => setAgillicWebdavPass(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="webdavPath">Template Path</Label>
                  <Input id="webdavPath" placeholder="/bcmportlet/webdav/bcm/media/templates/email/Bifrost/" value={agillicWebdavPath} onChange={(e) => setAgillicWebdavPath(e.target.value)} />
                </div>
                {agillicWebdavUser && agillicWebdavPass && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Email Templates</p>
                      <p className="text-xs text-muted-foreground">Sync HTML templates from Agillic WebDAV.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={syncingTemplates}
                      onClick={async () => {
                        setSyncingTemplates(true);
                        try {
                          const res = await fetch("/api/agillic/sync-templates", { method: "POST" });
                          const json = await res.json();
                          if (res.ok) { toast.success(json.message); }
                          else { toast.error(json.error || "Template sync failed"); }
                        } catch { toast.error("Template sync failed"); }
                        finally { setSyncingTemplates(false); }
                      }}
                    >
                      {syncingTemplates ? (<><CircleNotch className="mr-2 h-3 w-3 animate-spin" />Syncing...</>) : (<><ArrowsClockwise className="mr-1 h-3 w-3" />Sync Templates</>)}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resend Connection */}
      {emailProvider === "resend" && (<>
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
      </>)}

      {/* Consent Types — only shown for Resend orgs */}
      {emailProvider === "resend" && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" weight="duotone" />
              <CardTitle>Consent Types</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <a
                  href="/preferences/preview"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="ghost" type="button" className="text-xs h-7 px-2">
                    <Eye className="mr-1 h-3 w-3" />Preferences
                  </Button>
                </a>
                <a
                  href="/unsubscribe/preview"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="ghost" type="button" className="text-xs h-7 px-2">
                    <Eye className="mr-1 h-3 w-3" />Unsub
                  </Button>
                </a>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1 h-3 w-3" />Add
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add consent type</DialogTitle>
                  <DialogDescription>
                    Define a new consent category for your contacts.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. Weekly Newsletter"
                      value={newConsentName}
                      onChange={(e) => setNewConsentName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="What this consent covers"
                      value={newConsentDesc}
                      onChange={(e) => setNewConsentDesc(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Legal text (optional)</Label>
                    <Textarea
                      placeholder="Legal consent text shown to contacts"
                      value={newConsentLegal}
                      onChange={(e) => setNewConsentLegal(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                  <Button
                    disabled={addingConsent || !newConsentName.trim()}
                    onClick={async () => {
                      setAddingConsent(true);
                      const supabase = createClient();
                      const { data, error } = await supabase
                        .from("consent_types")
                        .insert({
                          org_id: org.id,
                          name: newConsentName.trim(),
                          description: newConsentDesc.trim() || null,
                          legal_text: newConsentLegal.trim() || null,
                        })
                        .select()
                        .single();
                      setAddingConsent(false);
                      if (error) {
                        toast.error("Failed to add consent type");
                      } else {
                        setConsentTypes([...consentTypes, data]);
                        setNewConsentName("");
                        setNewConsentDesc("");
                        setNewConsentLegal("");
                        toast.success("Consent type added");
                      }
                    }}
                  >
                    {addingConsent ? "Adding..." : "Add"}
                  </Button>
                </DialogFooter>
              </DialogContent>
              </Dialog>
            </div>
          </div>
          <CardDescription>
            Manage consent categories for your contacts. These appear in the preference center.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consentTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No consent types defined yet.
            </p>
          ) : (
            <div className="space-y-2">
              {consentTypes.map((ct) => (
                <div key={ct.id} className="rounded-md border">
                  <div className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium">{ct.name}</p>
                      {ct.description && (
                        <p className="text-xs text-muted-foreground">
                          {ct.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleVersionHistory(ct.id)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        v{ct.version}
                        {ct.version > 1 && (
                          <span className="ml-0.5">
                            {expandedHistory === ct.id ? "\u25B4" : "\u25BE"}
                          </span>
                        )}
                      </button>
                      <Badge variant={ct.is_active ? "default" : "outline"}>
                        {ct.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingConsent(ct);
                          setEditName(ct.name);
                          setEditDesc(ct.description ?? "");
                          setEditLegal(ct.legal_text ?? "");
                        }}
                      >
                        <PencilSimple className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const supabase = createClient();
                          const newActive = !ct.is_active;
                          const { error } = await supabase
                            .from("consent_types")
                            .update({ is_active: newActive })
                            .eq("id", ct.id);
                          if (error) {
                            toast.error("Failed to update");
                          } else {
                            setConsentTypes(
                              consentTypes.map((c) =>
                                c.id === ct.id
                                  ? { ...c, is_active: newActive }
                                  : c
                              )
                            );
                            toast.success(
                              newActive ? "Activated" : "Deactivated"
                            );
                          }
                        }}
                      >
                        {ct.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                  {expandedHistory === ct.id && (
                    <div className="px-3 pb-3 border-t">
                      {loadingHistory === ct.id ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                          <CircleNotch className="h-3 w-3 animate-spin" />
                          Loading history...
                        </div>
                      ) : (versionHistory[ct.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No version history yet.
                        </p>
                      ) : (
                        <div className="space-y-1 pt-2">
                          {(versionHistory[ct.id] ?? []).map((v) => (
                            <div
                              key={v.version}
                              className="flex items-start gap-2 text-xs"
                            >
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5"
                              >
                                v{v.version}
                              </Badge>
                              <span className="text-muted-foreground truncate flex-1">
                                {v.legal_text
                                  ? v.legal_text.length > 80
                                    ? v.legal_text.slice(0, 80) + "..."
                                    : v.legal_text
                                  : "No legal text"}
                              </span>
                              <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                {new Date(v.created_at).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      )}

      {/* Edit Consent Type Dialog */}
      <Dialog
        open={!!editingConsent}
        onOpenChange={(v) => {
          if (!v) setEditingConsent(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit consent type</DialogTitle>
            <DialogDescription>
              Changing legal text will create a new version.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Legal text</Label>
              <Textarea
                value={editLegal}
                onChange={(e) => setEditLegal(e.target.value)}
                className="min-h-[80px]"
              />
              {editingConsent &&
                editLegal.trim() !==
                  (editingConsent.legal_text ?? "") && (
                  <p className="text-xs text-amber-600">
                    Legal text changed &mdash; saving will create v
                    {editingConsent.version + 1}
                  </p>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingConsent(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editName.trim()}
            >
              {savingEdit ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
