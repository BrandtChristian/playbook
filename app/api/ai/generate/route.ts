import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT, type GenerateRequest } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, prompt, context, currentContent, structure, blockType } =
    (await request.json()) as GenerateRequest;

  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

  // Structure-aware fill: use structured outputs for guaranteed JSON
  if (type === "body" && structure && structure.length > 0) {
    const blockList = structure
      .map((t, i) => `${i + 1}. ${t.toUpperCase()}`)
      .join("\n");

    const userMessage = `Write email content for: ${prompt}${context ? `\nContext: ${context}` : ""}

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
        system: SYSTEM_PROMPT,
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
        return NextResponse.json(
          { error: "Unexpected response" },
          { status: 500 }
        );
      }

      // Parse the structured output and extract just the blocks array
      console.log("[AI Generate] Structured output:", content.text.slice(0, 300));
      const parsed = JSON.parse(content.text);
      const blocksArray = parsed.blocks || parsed;

      return NextResponse.json({
        result: JSON.stringify(blocksArray),
        type,
      });
    } catch (error) {
      console.error("AI generation error (structured):", error);
      return NextResponse.json(
        { error: "AI generation failed" },
        { status: 500 }
      );
    }
  }

  // All other generation types: plain text response
  let userMessage = "";

  switch (type) {
    case "subject":
      userMessage = `Generate 3 email subject line options for this email:\n\nDescription: ${prompt}${context ? `\nContext: ${context}` : ""}\n\nReturn ONLY the 3 subject lines, one per line, numbered 1-3. Use {{ first_name }} or {{ company }} where natural. Keep under 60 characters each.`;
      break;

    case "body":
      userMessage = `Write an email body for:\n\nDescription: ${prompt}${context ? `\nContext: ${context}` : ""}\n\nReturn ONLY the HTML email body content. Use Liquid variables ({{ first_name }}, {{ company }}) for personalization.`;
      break;

    case "improve":
      userMessage = `Improve this email body. Make it more engaging, clearer, and more effective:\n\nCurrent content:\n${currentContent}\n\nInstructions: ${prompt}\n\nReturn ONLY the improved HTML email body content. Preserve any Liquid variables.`;
      break;

    case "improve-block":
      userMessage = `Improve this ${blockType || "text"} block. Current content:\n${currentContent}\n\nInstructions: ${prompt}\n\nReturn ONLY the improved content:\n- For heading: return just the heading text (may include Liquid vars like {{ first_name }})\n- For text: return HTML paragraphs (<p>, <ul>, <a>, etc.)\n- For button: return JSON {"text": "label", "url": "https://..."}\n\nNo markdown fences, no explanation.`;
      break;

    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    console.log("[AI Generate] Type:", type, "Prompt:", prompt.slice(0, 100));

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response" },
        { status: 500 }
      );
    }

    console.log("[AI Generate] Result:", content.text.slice(0, 200));
    return NextResponse.json({ result: content.text, type });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }
}
