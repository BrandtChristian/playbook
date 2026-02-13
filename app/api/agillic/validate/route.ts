import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAgillicClient } from "@/lib/agillic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { api_key, api_secret, instance_url } = await request.json();

  if (!api_key || !api_secret || !instance_url) {
    return NextResponse.json(
      { error: "All credential fields are required" },
      { status: 400 }
    );
  }

  const client = createAgillicClient({ api_key, api_secret, instance_url });
  const valid = await client.testConnection();

  if (!valid) {
    return NextResponse.json(
      { error: "Failed to connect to Agillic. Check your credentials." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
