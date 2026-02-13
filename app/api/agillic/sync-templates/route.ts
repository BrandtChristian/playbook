import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listWebDAVTemplates,
  fetchWebDAVTemplate,
  extractVariables,
} from "@/lib/agillic/webdav";

/**
 * Sync templates from Agillic WebDAV into local cache.
 * Uses staging URL + WebDAV credentials.
 */
export async function POST() {
  const supabase = await createClient();
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

  if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("email_provider, agillic_credentials")
    .eq("id", profile.org_id)
    .single();

  if (!org || org.email_provider !== "agillic" || !org.agillic_credentials) {
    return NextResponse.json({ error: "Agillic not configured" }, { status: 400 });
  }

  const creds = org.agillic_credentials as {
    staging_url: string;
    webdav_username?: string;
    webdav_password?: string;
    webdav_path?: string;
  };

  if (!creds.webdav_username || !creds.webdav_password) {
    return NextResponse.json(
      { error: "WebDAV credentials required for template sync" },
      { status: 400 }
    );
  }

  try {
    // List templates from WebDAV
    const files = await listWebDAVTemplates(
      creds.staging_url,
      creds.webdav_username,
      creds.webdav_password,
      creds.webdav_path
    );

    const now = new Date().toISOString();
    let synced = 0;

    // Fetch and cache each template
    for (const file of files) {
      try {
        const html = await fetchWebDAVTemplate(
          creds.staging_url,
          creds.webdav_username,
          creds.webdav_password,
          file.name,
          creds.webdav_path
        );

        const variables = extractVariables(html);

        await supabase.from("agillic_template_cache").upsert(
          {
            org_id: profile.org_id,
            template_name: file.name,
            html_content: html,
            detected_variables: variables,
            webdav_last_modified: file.lastModified || null,
            synced_at: now,
            is_active: true,
          },
          { onConflict: "org_id,template_name" }
        );

        synced++;
      } catch {
        // Skip individual template failures
      }
    }

    return NextResponse.json({
      synced,
      total: files.length,
      message: `Synced ${synced} of ${files.length} templates`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Template sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
