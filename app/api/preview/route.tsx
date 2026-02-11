import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import { BaseEmailLayout } from "@/lib/email/base-layout";
import { renderTemplate } from "@/lib/liquid";

export async function POST(request: NextRequest) {
  const { bodyHtml, fromName, previewText } = await request.json();

  if (!bodyHtml) {
    return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
  }

  // Render Liquid variables with sample data
  const renderedBody = await renderTemplate(bodyHtml);

  // Wrap in React Email base layout and render to HTML
  const html = await render(
    <BaseEmailLayout
      bodyHtml={renderedBody}
      fromName={fromName || "Your Company"}
      previewText={previewText}
      unsubscribeUrl="#"
    />
  );

  return NextResponse.json({ html });
}
