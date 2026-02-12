import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import { BaseEmailLayout } from "@/lib/email/base-layout";
import type { BrandConfig } from "@/lib/email/base-layout";
import { renderTemplate } from "@/lib/liquid";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bodyHtml, fromName, previewText, brandConfig } = await request.json() as {
    bodyHtml?: string;
    fromName?: string;
    previewText?: string;
    brandConfig?: BrandConfig;
  };

  if (!bodyHtml) {
    return NextResponse.json({ error: "bodyHtml is required" }, { status: 400 });
  }

  const renderedBody = await renderTemplate(bodyHtml);

  const html = await render(
    <BaseEmailLayout
      bodyHtml={renderedBody}
      fromName={fromName || "Your Company"}
      previewText={previewText}
      unsubscribeUrl="#"
      brandConfig={brandConfig}
    />
  );

  // Inject ResizeObserver script so the parent iframe auto-sizes
  const heightScript = `<script>new ResizeObserver(()=>{window.parent.postMessage({type:'preview-height',height:document.body.scrollHeight},window.location.origin)}).observe(document.body)</script>`;

  return NextResponse.json({ html: html + heightScript });
}
