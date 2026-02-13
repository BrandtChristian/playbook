import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { openai, AI_MODEL, AI_TEMPERATURES, AI_LIMITS, validateBrandConfig, type AiErrorCode } from "@/lib/ai";
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

function jsonError(error: string, code: AiErrorCode, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("Unauthorized", "UNAUTHORIZED", 401);
  }

  const { allowed, retryAfterMs } = checkRateLimit(user.id);
  if (!allowed) {
    const retryAfter = Math.ceil((retryAfterMs ?? 60000) / 1000);
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${retryAfter} seconds.`, code: "RATE_LIMITED" as AiErrorCode, retryAfter },
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
    return jsonError("company_name is required", "VALIDATION_ERROR", 400);
  }
  if (company_name.length > AI_LIMITS.MAX_BRAND_FIELD_LENGTH) {
    return jsonError("company_name is too long", "VALIDATION_ERROR", 400);
  }
  if (description && description.length > AI_LIMITS.MAX_PROMPT_LENGTH) {
    return jsonError("description is too long", "VALIDATION_ERROR", 400);
  }
  if (iteration_prompt && iteration_prompt.length > AI_LIMITS.MAX_PROMPT_LENGTH) {
    return jsonError("iteration_prompt is too long", "VALIDATION_ERROR", 400);
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
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 512,
      temperature: AI_TEMPERATURES.brand,
      messages: [
        { role: "system", content: BRAND_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";

    // Parse the JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonError("Failed to parse brand config from AI response", "PARSE_ERROR", 500);
    }

    let rawConfig: Record<string, unknown>;
    try {
      rawConfig = JSON.parse(jsonMatch[0]);
    } catch {
      return jsonError("Invalid JSON in brand config response", "PARSE_ERROR", 500);
    }

    // Validate and fill defaults for missing/invalid fields
    const brandValidation = validateBrandConfig(rawConfig);
    if (!brandValidation.valid) {
      console.warn("[Brand AI] Validation failed:", brandValidation.error, rawConfig);
      // Fill safe defaults rather than failing
      if (!rawConfig.primary_color || typeof rawConfig.primary_color !== "string") rawConfig.primary_color = "#6366f1";
      if (!rawConfig.secondary_color || typeof rawConfig.secondary_color !== "string") rawConfig.secondary_color = "#818cf8";
      if (!rawConfig.header_bg_color || typeof rawConfig.header_bg_color !== "string") rawConfig.header_bg_color = "#6366f1";
      if (!rawConfig.text_color || typeof rawConfig.text_color !== "string") rawConfig.text_color = "#1c1917";
      if (!rawConfig.footer_text || typeof rawConfig.footer_text !== "string") rawConfig.footer_text = company_name;
    }

    const brandConfig = rawConfig as Record<string, string>;
    if (logo_url) {
      brandConfig.logo_url = logo_url;
    }

    return NextResponse.json({ brand_config: brandConfig });
  } catch (error) {
    console.error("Brand generation error:", error);
    return jsonError("Failed to generate brand config. Please try again.", "AI_SERVICE_ERROR", 500);
  }
}
