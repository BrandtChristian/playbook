import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

const BRAND_SYSTEM_PROMPT = `You are a brand identity designer for email marketing templates.
Given a company description, generate a cohesive email brand configuration.

Return ONLY valid JSON with these exact keys:
- primary_color (hex, e.g. "#6366f1")
- secondary_color (hex, complementary to primary)
- header_bg_color (hex, for the email header background)
- text_color (hex, for body text — must be dark enough for readability)
- footer_text (a short company tagline or description, max 10 words)

Rules:
- Colors must have good contrast (WCAG AA minimum)
- Professional and clean aesthetic
- The header_bg_color should be bold/branded (can match primary_color)
- text_color should always be dark (#1a1a1a to #4a4a4a range)
- Return ONLY the JSON object, no markdown, no explanation`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = checkRateLimit(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  const {
    company_name,
    industry,
    tone,
    brand_colors,
    logo_url,
    description,
    iteration_prompt,
    previous_config,
  } = await request.json();

  if (!company_name) {
    return NextResponse.json(
      { error: "company_name is required" },
      { status: 400 }
    );
  }

  let userMessage = `Design an email brand for:
Company: ${company_name}
Industry: ${industry || "General"}
Tone: ${tone || "Professional"}
What they email about: ${description || "General business communications"}`;

  if (brand_colors) {
    userMessage += `\nPreferred colors: ${brand_colors}`;
  }

  if (previous_config && iteration_prompt) {
    userMessage += `\n\nCurrent brand config: ${JSON.stringify(previous_config)}
Please adjust based on this feedback: ${iteration_prompt}`;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: BRAND_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse brand config" },
        { status: 500 }
      );
    }

    const brandConfig = JSON.parse(jsonMatch[0]);

    // Add logo_url if provided
    if (logo_url) {
      brandConfig.logo_url = logo_url;
    }

    return NextResponse.json({ brand_config: brandConfig });
  } catch (error) {
    console.error("Brand generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate brand config" },
      { status: 500 }
    );
  }
}
