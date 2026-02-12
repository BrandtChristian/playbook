import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { flowId } = (await request.json()) as { flowId?: string };

  if (!flowId || typeof flowId !== "string") {
    return NextResponse.json({ error: "flowId is required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("seen_flows")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const seenFlows = (profile.seen_flows as Record<string, string>) || {};
  seenFlows[flowId] = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ seen_flows: seenFlows })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
