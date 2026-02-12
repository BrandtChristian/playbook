import { NextResponse } from "next/server";
import { anthropic } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl } = await request.json();

  if (!imageUrl) {
    return NextResponse.json(
      { error: "imageUrl is required" },
      { status: 400 }
    );
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 128,
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
        { error: "Unexpected response" },
        { status: 500 }
      );
    }

    return NextResponse.json({ alt: content.text.trim() });
  } catch (error) {
    console.error("Alt text generation error:", error);
    return NextResponse.json(
      { error: "Alt text generation failed" },
      { status: 500 }
    );
  }
}
