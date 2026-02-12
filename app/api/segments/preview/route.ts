import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewSegmentFilter } from "@/lib/segments/evaluate";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, filterRules } = await request.json();

  if (!orgId || !filterRules) {
    return NextResponse.json(
      { error: "orgId and filterRules are required" },
      { status: 400 }
    );
  }

  try {
    const contacts = await previewSegmentFilter(supabase, orgId, filterRules);
    const sample = contacts.slice(0, 5);
    return NextResponse.json({
      count: contacts.length,
      sample: sample.map((c: { id: string; email: string; first_name: string | null; last_name: string | null }) => ({
        id: c.id,
        email: c.email,
        first_name: c.first_name,
        last_name: c.last_name,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 }
    );
  }
}
