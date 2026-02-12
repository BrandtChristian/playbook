import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getResendClient } from "@/lib/resend";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function buildInviteEmailHtml(orgName: string, role: string, magicLink: string) {
  return `
    <div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #1c1917; font-size: 24px; font-weight: 700; margin-bottom: 16px;">
        You're invited!
      </h2>
      <p style="color: #57534e; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        You've been invited to join <strong>${orgName}</strong> on Forge as ${role === "admin" ? "an admin" : "a member"}.
      </p>
      <a href="${magicLink}"
         style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 0px;">
        Get started
      </a>
      <p style="color: #a8a29e; font-size: 13px; margin-top: 32px;">
        This link will log you in automatically. If you didn't expect this invitation, you can ignore this email.
      </p>
    </div>
  `;
}

async function sendInviteEmail(
  org: { name: string; resend_api_key: string | null; from_email: string | null; from_name: string | null },
  email: string,
  role: string,
  magicLinkUrl: string
) {
  if (!org.resend_api_key) return;

  const resend = getResendClient(org.resend_api_key);
  await resend.emails.send({
    from: org.from_email
      ? `${org.from_name || org.name} <${org.from_email}>`
      : `Forge <onboarding@resend.dev>`,
    to: [email],
    subject: `You've been invited to ${org.name} on Forge`,
    html: buildInviteEmailHtml(org.name, role, magicLinkUrl),
  });
}

export async function POST(request: NextRequest) {
  // 1. Authenticate caller
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

  // 2. Parse and validate
  const { email, role } = (await request.json()) as {
    email?: string;
    role?: string;
  };

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  if (role && !["admin", "member"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be admin or member" },
      { status: 400 }
    );
  }

  const inviteRole = role || "member";
  const adminClient = getServiceClient();

  // 3. Get org details for the invite email
  const { data: org } = await adminClient
    .from("organizations")
    .select("name, resend_api_key, from_email, from_name")
    .eq("id", profile.org_id)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  // 4. Check if user already exists in this org
  const { data: existingProfiles } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .eq("org_id", profile.org_id);

  const { data: allUsers } = await adminClient.auth.admin.listUsers();
  const existingAuthUser = allUsers?.users?.find((u) => u.email === email);

  if (
    existingAuthUser &&
    existingProfiles?.some((p) => p.id === existingAuthUser.id)
  ) {
    return NextResponse.json(
      { error: "User is already a member of this organization" },
      { status: 409 }
    );
  }

  const origin = request.headers.get("origin") || "http://localhost:3000";

  try {
    let magicLinkUrl: string | undefined;

    if (existingAuthUser) {
      // User exists in auth.users but not in this org — add them directly
      await adminClient.from("profiles").insert({
        id: existingAuthUser.id,
        org_id: profile.org_id,
        full_name:
          existingAuthUser.user_metadata?.full_name ||
          email.split("@")[0],
        role: inviteRole,
      });

      // Generate a magic link so they can log in
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${origin}/auth/accept` },
        });

      if (linkError) {
        console.error("Failed to generate magic link:", linkError);
      } else {
        magicLinkUrl = linkData?.properties?.action_link;
      }
    } else {
      // New user — create via admin API
      const { error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            invited_org_id: profile.org_id,
            invited_role: inviteRole,
          },
        });

      if (createError) {
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      // Generate a magic link for the new user
      const { data: linkData, error: linkError } =
        await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${origin}/auth/accept` },
        });

      if (linkError) {
        console.error("Failed to generate magic link:", linkError);
      } else {
        magicLinkUrl = linkData?.properties?.action_link;
      }
    }

    // 5. Record in invitations table
    await supabase.from("invitations").upsert(
      {
        org_id: profile.org_id,
        email,
        role: inviteRole,
        invited_by: user.id,
        status: "accepted",
      },
      { onConflict: "org_id,email" }
    );

    // 6. Send invite email via Resend if org has an API key and we have a magic link
    if (magicLinkUrl) {
      try {
        await sendInviteEmail(org, email, inviteRole, magicLinkUrl);
      } catch (emailError) {
        console.error("Failed to send invite email:", emailError);
        // Don't fail the whole request — user was still created
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  // Resend invite email to an existing member
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

  const { memberId } = (await request.json()) as { memberId?: string };
  if (!memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 }
    );
  }

  const adminClient = getServiceClient();

  // Verify the member belongs to this org
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", memberId)
    .single();

  if (!targetProfile || targetProfile.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Get org details
  const { data: org } = await adminClient
    .from("organizations")
    .select("name, resend_api_key, from_email, from_name")
    .eq("id", profile.org_id)
    .single();

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  if (!org.resend_api_key) {
    return NextResponse.json(
      { error: "Configure Resend API key first to send invite emails" },
      { status: 400 }
    );
  }

  // Look up the member's email from auth
  const { data: authUser, error: authError } =
    await adminClient.auth.admin.getUserById(memberId);

  if (authError || !authUser?.user?.email) {
    return NextResponse.json(
      { error: "Could not find user email" },
      { status: 404 }
    );
  }

  const email = authUser.user.email;
  const origin = request.headers.get("origin") || "http://localhost:3000";

  // Generate a fresh magic link
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/auth/accept` },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: "Failed to generate login link" },
      { status: 500 }
    );
  }

  // Send invite email
  try {
    await sendInviteEmail(
      org,
      email,
      targetProfile.role,
      linkData.properties.action_link
    );
  } catch (emailError) {
    console.error("Failed to send invite email:", emailError);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  // Remove a member from the org (owner only)
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

  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      { error: "Owner access required" },
      { status: 403 }
    );
  }

  const { memberId } = (await request.json()) as { memberId?: string };
  if (!memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 }
    );
  }

  if (memberId === user.id) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 }
    );
  }

  // Verify the member belongs to this org
  const adminClient = getServiceClient();
  const { data: targetProfile } = await adminClient
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", memberId)
    .single();

  if (!targetProfile || targetProfile.org_id !== profile.org_id) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetProfile.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the owner" },
      { status: 400 }
    );
  }

  // Delete the auth user (cascades to profile via FK)
  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(memberId);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
