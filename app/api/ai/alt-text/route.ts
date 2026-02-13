import { NextResponse } from "next/server";
import { anthropic, AI_TEMPERATURES, type AiErrorCode } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" as AiErrorCode }, { status: 401 });
  }

  const { allowed, retryAfterMs } = checkRateLimit(user.id);
  if (!allowed) {
    const retryAfter = Math.ceil((retryAfterMs ?? 60000) / 1000);
    return NextResponse.json(
      { error: `Rate limit reached. Try again in ${retryAfter} seconds.`, code: "RATE_LIMITED" as AiErrorCode, retryAfter },
      { status: 429 }
    );
  }

  const { imageUrl } = await request.json();

  if (!imageUrl) {
    return NextResponse.json(
      { error: "imageUrl is required", code: "VALIDATION_ERROR" as AiErrorCode },
      { status: 400 }
    );
  }

  // SSRF protection: only allow public HTTPS URLs
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "Only HTTPS URLs are allowed", code: "VALIDATION_ERROR" as AiErrorCode },
        { status: 400 }
      );
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname.endsWith(".internal") ||
      hostname === "[::1]"
    ) {
      return NextResponse.json(
        { error: "Private/reserved URLs are not allowed", code: "VALIDATION_ERROR" as AiErrorCode },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid URL", code: "VALIDATION_ERROR" as AiErrorCode },
      { status: 400 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 128,
      temperature: AI_TEMPERATURES["alt-text"],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: "Write a concise alt text description for this image, suitable for use in a marketing email. Keep it under 125 characters. Return ONLY the alt text, no quotes or extra formatting.",
            },
          ],
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response", code: "AI_SERVICE_ERROR" as AiErrorCode },
        { status: 500 }
      );
    }

    return NextResponse.json({ alt: content.text.trim() });
  } catch (error) {
    console.error("Alt text generation error:", error);
    return NextResponse.json(
      { error: "Alt text generation failed. Please try again.", code: "AI_SERVICE_ERROR" as AiErrorCode },
      { status: 500 }
    );
  }
}
