import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  const { data: rows } = await supabase
    .from("user_segment_access")
    .select("segment_id")
    .eq("user_id", userId);

  const segmentIds = (rows ?? []).map((r) => r.segment_id);

  return NextResponse.json({
    restricted: segmentIds.length > 0,
    segmentIds,
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  const { userId, segmentIds } = (await request.json()) as {
    userId?: string;
    segmentIds?: string[];
  };

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  // Verify target is a member in the same org
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", userId)
    .single();

  if (!targetProfile || targetProfile.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetProfile.role !== "member") {
    return NextResponse.json(
      { error: "Can only restrict members, not admins or owners" },
      { status: 400 }
    );
  }

  // Delete all existing access rows for this user
  await supabase
    .from("user_segment_access")
    .delete()
    .eq("user_id", userId);

  // Insert new rows if any (restricted mode)
  if (segmentIds && segmentIds.length > 0) {
    const rows = segmentIds.map((segmentId) => ({
      user_id: userId,
      segment_id: segmentId,
    }));

    const { error: insertError } = await supabase
      .from("user_segment_access")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
