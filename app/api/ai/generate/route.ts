import { NextRequest, NextResponse } from "next/server";
import {
  anthropic,
  buildSystemPrompt,
  validateGenerateRequest,
  parseSubjectLines,
  AI_TEMPERATURES,
  type GenerateRequest,
  type OrgContext,
  type AiErrorCode,
} from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// JSON schema for structure-aware block filling
function buildBlockFillSchema(structure: string[]) {
  const itemSchemas = structure.map((blockType) => {
    switch (blockType) {
      case "heading":
        return {
          type: "object" as const,
          properties: { text: { type: "string" as const } },
          required: ["text"],
          additionalProperties: false,
        };
      case "text":
        return {
          type: "object" as const,
          properties: { html: { type: "string" as const } },
          required: ["html"],
          additionalProperties: false,
        };
      case "button":
        return {
          type: "object" as const,
          properties: {
            text: { type: "string" as const },
            url: { type: "string" as const },
          },
          required: ["text", "url"],
          additionalProperties: false,
        };
      default:
        // image, divider, spacer → nullable
        return { type: "null" as const };
    }
  });

  return {
    type: "object" as const,
    properties: {
      blocks: {
        type: "array" as const,
        items: itemSchemas.length === 1
          ? itemSchemas[0]
          : { anyOf: [
              {
                type: "object" as const,
                properties: { text: { type: "string" as const } },
                required: ["text"],
                additionalProperties: false,
              },
              {
                type: "object" as const,
                properties: { html: { type: "string" as const } },
                required: ["html"],
                additionalProperties: false,
              },
              {
                type: "object" as const,
                properties: {
                  text: { type: "string" as const },
                  url: { type: "string" as const },
                },
                required: ["text", "url"],
                additionalProperties: false,
              },
              { type: "null" as const },
            ] },
      },
    },
    required: ["blocks"],
    additionalProperties: false,
  };
}

function jsonError(error: string, code: AiErrorCode, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: NextRequest) {
  // Auth check
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
      {
        error: `Rate limit reached. Try again in ${retryAfter} seconds.`,
        code: "RATE_LIMITED" as AiErrorCode,
        retryAfter,
      },
      { status: 429 }
    );
  }

  // Parse + validate request body
  const body = (await request.json()) as GenerateRequest;
  const validation = validateGenerateRequest(body);
  if (!validation.valid) {
    return jsonError(validation.error, "VALIDATION_ERROR", 400);
  }

  const { type, prompt, context, currentContent, structure, blockType, templateName, emailPurpose } = body;

  // Fetch org context for richer AI prompts
  let orgContext: OrgContext | undefined;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
      const [{ data: org }, { data: customFields }] = await Promise.all([
        supabase
          .from("organizations")
          .select("name, from_name, brand_config")
          .eq("id", profile.org_id)
          .single(),
        supabase
          .from("custom_field_definitions")
          .select("field_name")
          .eq("org_id", profile.org_id),
      ]);

      if (org) {
        orgContext = {
          orgName: org.name,
          fromName: org.from_name ?? undefined,
          brandConfig: org.brand_config as OrgContext["brandConfig"],
          customFieldNames: (customFields ?? []).map((f: { field_name: string }) => f.field_name),
        };
      }
    }
  } catch (e) {
    console.warn("[AI Generate] Failed to fetch org context, using default prompt:", e);
  }

  const systemPrompt = buildSystemPrompt(orgContext);

  // Build context suffix for user messages
  const contextParts: string[] = [];
  if (context) contextParts.push(`Context: ${context}`);
  if (templateName) contextParts.push(`Template: ${templateName}`);
  if (emailPurpose) contextParts.push(`Purpose: ${emailPurpose}`);
  const contextSuffix = contextParts.length > 0 ? "\n" + contextParts.join("\n") : "";

  // Structure-aware fill: use structured outputs for guaranteed JSON
  if (type === "body" && structure && structure.length > 0) {
    const blockList = structure
      .map((t, i) => `${i + 1}. ${t.toUpperCase()}`)
      .join("\n");

    const userMessage = `Write email content for: ${prompt}${contextSuffix}

The email has this block layout (fill each block in order):
${blockList}

Return a "blocks" array where each element matches the block at that position:
- For HEADING blocks: { "text": "heading text here" }
- For TEXT blocks: { "html": "<p>paragraph content</p>" } (use <p>, <strong>, <em>, <a>, <ul>, <li>)
- For BUTTON blocks: { "text": "button label", "url": "https://example.com" }
- For DIVIDER/SPACER/IMAGE blocks: null

Use Liquid variables ({{ first_name }}, {{ company }}) where natural.`;

    try {
      const schema = buildBlockFillSchema(structure);
      console.log("[AI Generate] Structure-aware fill, schema:", JSON.stringify(schema).slice(0, 300));

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        temperature: AI_TEMPERATURES.body,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        output_config: {
          format: {
            type: "json_schema",
            schema,
          },
        },
      });

      const content = message.content[0];
      if (content.type !== "text") {
        return jsonError("Unexpected AI response format", "AI_SERVICE_ERROR", 500);
      }

      console.log("[AI Generate] Structured output:", content.text.slice(0, 300));
      const parsed = JSON.parse(content.text);
      const blocksArray: unknown[] = parsed.blocks || parsed;

      // Pad/truncate to match structure length
      if (Array.isArray(blocksArray)) {
        while (blocksArray.length < structure.length) blocksArray.push(null);
        if (blocksArray.length > structure.length) blocksArray.length = structure.length;
      }

      return NextResponse.json({
        result: JSON.stringify(blocksArray),
        type,
      });
    } catch (error) {
      console.error("AI generation error (structured):", error);
      return jsonError("AI generation failed. Please try again.", "AI_SERVICE_ERROR", 500);
    }
  }

  // All other generation types: plain text response
  let userMessage = "";

  switch (type) {
    case "subject":
      userMessage = `Generate 3 email subject line options for this email:\n\nDescription: ${prompt}${contextSuffix}\n\nReturn ONLY the 3 subject lines, one per line, numbered 1-3. Use {{ first_name }} or {{ company }} where natural. Keep under 60 characters each.`;
      break;

    case "body":
      userMessage = `Write an email body for:\n\nDescription: ${prompt}${contextSuffix}\n\nReturn ONLY the HTML email body content. Use Liquid variables ({{ first_name }}, {{ company }}) for personalization.`;
      break;

    case "improve":
      userMessage = `Improve this email body. Make it more engaging, clearer, and more effective:\n\nCurrent content:\n${currentContent}\n\nInstructions: ${prompt}\n\nReturn ONLY the improved HTML email body content. Preserve any Liquid variables.`;
      break;

    case "improve-block":
      userMessage = `Improve this ${blockType || "text"} block. Current content:\n${currentContent}\n\nInstructions: ${prompt}\n\nReturn ONLY the improved content:\n- For heading: return just the heading text (may include Liquid vars like {{ first_name }})\n- For text: return HTML paragraphs (<p>, <ul>, <a>, etc.)\n- For button: return JSON {"text": "label", "url": "https://..."}\n\nNo markdown fences, no explanation.`;
      break;

    default:
      return jsonError("Invalid type", "VALIDATION_ERROR", 400);
  }

  try {
    console.log("[AI Generate] Type:", type, "Prompt:", prompt.slice(0, 100));

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      temperature: AI_TEMPERATURES[type] ?? 1.0,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return jsonError("Unexpected AI response format", "AI_SERVICE_ERROR", 500);
    }

    console.log("[AI Generate] Result:", content.text.slice(0, 200));

    // For subject lines, also return a parsed array
    if (type === "subject") {
      const subjects = parseSubjectLines(content.text);
      return NextResponse.json({ result: content.text, subjects, type });
    }

    return NextResponse.json({ result: content.text, type });
  } catch (error) {
    console.error("AI generation error:", error);
    const msg = error instanceof Error && error.message?.includes("rate")
      ? "AI service is busy. Please try again in a moment."
      : "AI generation failed. Please try again.";
    const code: AiErrorCode = error instanceof Error && error.message?.includes("rate")
      ? "RATE_LIMITED"
      : "AI_SERVICE_ERROR";
    return jsonError(msg, code, code === "RATE_LIMITED" ? 503 : 500);
  }
}
