import { NextRequest, NextResponse } from "next/server";
import { anthropic, SYSTEM_PROMPT, type GenerateRequest } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, prompt, context, currentContent } =
    (await request.json()) as GenerateRequest;

  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required" },
      { status: 400 }
    );
  }

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

    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
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

    return NextResponse.json({ result: content.text, type });
  } catch (error) {
    console.error("AI generation error:", error);
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }
}
