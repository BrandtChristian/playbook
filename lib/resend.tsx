import { Resend } from "resend";
import { render } from "@react-email/render";
import { BaseEmailLayout } from "@/lib/email/base-layout";
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
}: {
  bodyHtml: string;
  data: Record<string, unknown>;
  fromName?: string;
}): Promise<string> {
  // Render Liquid variables
  const renderedBody = await renderTemplate(bodyHtml, data);

  // Wrap in React Email base layout
  const html = await render(
    <BaseEmailLayout
      bodyHtml={renderedBody}
      fromName={fromName || "Your Company"}
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
}: {
  bodyHtml: string;
  fromName?: string;
}): Promise<string> {
  return renderEmail({ bodyHtml, data: sampleData, fromName });
}
