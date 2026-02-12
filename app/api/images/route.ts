import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth/dal";

export async function GET() {
  const user = await getCurrentUser();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: files, error } = await supabase.storage
    .from("email-images")
    .list(user.org_id, {
      limit: 50,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) {
    return NextResponse.json(
      { error: "Failed to list images" },
      { status: 500 }
    );
  }

  const images = (files || [])
    .filter((f) => !f.name.startsWith("."))
    .map((f) => {
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("email-images")
        .getPublicUrl(`${user.org_id}/${f.name}`);
      return {
        name: f.name,
        url: publicUrl,
        created_at: f.created_at,
      };
    });

  return NextResponse.json({ images });
}
