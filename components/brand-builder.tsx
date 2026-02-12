"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleNotch,
  FloppyDisk,
  Sparkle,
  ArrowsClockwise,
  Eye,
} from "@phosphor-icons/react";

export type BrandConfig = {
  primary_color?: string;
  secondary_color?: string;
  header_bg_color?: string;
  text_color?: string;
  logo_url?: string;
  footer_text?: string;
};

const TONES = ["Formal", "Professional", "Friendly", "Casual"] as const;

export function BrandBuilder({
  orgId,
  orgName,
  existingConfig,
  onBack,
  onSaved,
}: {
  orgId: string;
  orgName: string;
  existingConfig?: BrandConfig;
  onBack: () => void;
  onSaved: (config: BrandConfig) => void;
}) {
  const [companyName, setCompanyName] = useState(orgName);
  const [industry, setIndustry] = useState("");
  const [tone, setTone] = useState<string>("Professional");
  const [logoUrl, setLogoUrl] = useState(existingConfig?.logo_url || "");
  const [primaryColor, setPrimaryColor] = useState(existingConfig?.primary_color || "");
  const [description, setDescription] = useState("");
  const [iterationPrompt, setIterationPrompt] = useState("");

  const [brandConfig, setBrandConfig] = useState<BrandConfig | null>(existingConfig || null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fetchPreview = useCallback(async (config: BrandConfig) => {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyHtml: `<h1 style="color: ${config.primary_color}; margin: 0 0 16px 0;">Welcome to ${companyName}!</h1>
<p style="color: ${config.text_color}; line-height: 1.6; margin: 0 0 16px 0;">Hello {{ first_name }},</p>
<p style="color: ${config.text_color}; line-height: 1.6; margin: 0 0 24px 0;">We're excited to have you on board. This is a preview of how your branded emails will look. Every email you send — from welcome series to newsletters to campaigns — will use this design.</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><a href="#" style="background-color: ${config.primary_color}; color: #ffffff; padding: 12px 32px; text-decoration: none; font-weight: 600; display: inline-block;">Get Started</a></td></tr></table>`,
          fromName: companyName,
          brandConfig: config,
        }),
      });
      const json = await res.json();
      if (res.ok) setPreviewHtml(json.html);
    } catch {
      // Silently fail preview
    } finally {
      setLoadingPreview(false);
    }
  }, [companyName]);

  useEffect(() => {
    if (brandConfig) {
      fetchPreview(brandConfig);
    }
  }, [brandConfig, fetchPreview]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          industry,
          tone,
          brand_colors: primaryColor || undefined,
          logo_url: logoUrl || undefined,
          description,
        }),
      });
      const json = await res.json();
      if (res.ok && json.brand_config) {
        const config = {
          ...json.brand_config,
          logo_url: logoUrl || json.brand_config.logo_url,
        };
        setBrandConfig(config);
        toast.success("Brand generated!");
      } else {
        toast.error(json.error || "Failed to generate brand");
      }
    } catch {
      toast.error("Failed to generate brand");
    } finally {
      setGenerating(false);
    }
  }

  async function handleIterate() {
    if (!iterationPrompt.trim() || !brandConfig) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          industry,
          tone,
          logo_url: logoUrl || undefined,
          description,
          previous_config: brandConfig,
          iteration_prompt: iterationPrompt,
        }),
      });
      const json = await res.json();
      if (res.ok && json.brand_config) {
        const config = {
          ...json.brand_config,
          logo_url: logoUrl || json.brand_config.logo_url,
        };
        setBrandConfig(config);
        setIterationPrompt("");
        toast.success("Brand updated!");
      } else {
        toast.error(json.error || "Failed to update brand");
      }
    } catch {
      toast.error("Failed to update brand");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!brandConfig) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("organizations")
      .update({ brand_config: brandConfig })
      .eq("id", orgId);

    setSaving(false);
    if (error) {
      toast.error("Failed to save brand");
    } else {
      toast.success("Brand saved! All emails will use this design.");
      onSaved(brandConfig);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brand Builder</h1>
            <p className="text-sm text-muted-foreground">
              Design your email brand identity with AI
            </p>
          </div>
        </div>
        {brandConfig && (
          <Button onClick={handleSave} disabled={saving}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Brand"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr] min-h-[500px]">
        {/* Left: Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>Company name</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Industry</Label>
                  <Input
                    placeholder="e.g. SaaS, Retail, Healthcare"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Brand color (optional)</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={primaryColor || "#6366f1"}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      placeholder="#6366f1"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Tone</Label>
                <div className="flex gap-2">
                  {TONES.map((t) => (
                    <Badge
                      key={t}
                      variant={tone === t ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setTone(t)}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Logo URL (optional)</Label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>What do you email about?</Label>
                <Textarea
                  placeholder="e.g. Product updates, weekly newsletters, promotional offers for our e-commerce store"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating || !companyName.trim()}
                className="w-full"
              >
                {generating ? (
                  <><CircleNotch className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                ) : (
                  <><Sparkle className="mr-2 h-4 w-4" />Generate Brand</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Iteration */}
          {brandConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Refine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => { setIterationPrompt("Make it warmer and more friendly"); }}
                  >
                    Make it warmer
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => { setIterationPrompt("Use more blue tones"); }}
                  >
                    Use blue tones
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => { setIterationPrompt("Make it more corporate and formal"); }}
                  >
                    More corporate
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => { setIterationPrompt("Use darker, more elegant colors"); }}
                  >
                    Darker/elegant
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Make it warmer, use more blue..."
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleIterate(); }}
                  />
                  <Button
                    variant="outline"
                    onClick={handleIterate}
                    disabled={generating || !iterationPrompt.trim()}
                  >
                    <ArrowsClockwise className="h-4 w-4" />
                  </Button>
                </div>

                {/* Color swatches */}
                <div className="flex gap-3 pt-2">
                  {[
                    { label: "Primary", color: brandConfig.primary_color },
                    { label: "Secondary", color: brandConfig.secondary_color },
                    { label: "Header", color: brandConfig.header_bg_color },
                    { label: "Text", color: brandConfig.text_color },
                  ].map((swatch) => (
                    <div key={swatch.label} className="flex items-center gap-1.5">
                      <div
                        className="h-5 w-5 rounded border"
                        style={{ backgroundColor: swatch.color }}
                      />
                      <span className="text-xs text-muted-foreground">{swatch.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Email Preview
            {loadingPreview && (
              <CircleNotch className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </Label>
          <Card className="min-h-[480px] overflow-auto bg-[#f6f6f6] p-0 sticky top-4">
            <CardContent className="p-0">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full min-h-[480px] border-0"
                  sandbox="allow-same-origin"
                  title="Brand preview"
                />
              ) : (
                <div className="flex items-center justify-center min-h-[480px] text-sm text-muted-foreground">
                  Fill in your brand details and click Generate to see a preview
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
