import { Resend } from "resend";
import { render } from "@react-email/render";
import { BaseEmailLayout } from "@/lib/email/base-layout";
import type { BrandConfig } from "@/lib/email/base-layout";
import { renderTemplate, sampleData } from "@/lib/liquid";

export function getResendClient(apiKey: string) {
  return new Resend(apiKey);
}

/**
 * Render a template with contact data and wrap in the email base layout.
 */
export async function renderEmail({
  bodyHtml,
  data,
  fromName,
  brandConfig,
  unsubscribeUrl,
}: {
  bodyHtml: string;
  data: Record<string, unknown>;
  fromName?: string;
  brandConfig?: BrandConfig;
  unsubscribeUrl?: string;
}): Promise<string> {
  const renderedBody = await renderTemplate(bodyHtml, data);

  const html = await render(
    <BaseEmailLayout
      bodyHtml={renderedBody}
      fromName={fromName || "Your Company"}
      brandConfig={brandConfig}
      unsubscribeUrl={unsubscribeUrl}
    />
  );

  return html;
}

/**
 * Render a template with sample data for preview/test.
 */
export async function renderTestEmail({
  bodyHtml,
  fromName,
  brandConfig,
}: {
  bodyHtml: string;
  fromName?: string;
  brandConfig?: BrandConfig;
}): Promise<string> {
  return renderEmail({ bodyHtml, data: sampleData, fromName, brandConfig });
}
