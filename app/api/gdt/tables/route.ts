import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createStagingClient, GlobalDataAPIClient } from "@/lib/agillic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (user.organizations.email_provider !== "agillic") {
      return NextResponse.json(
        { error: "GDT Editor is only available for Agillic organizations" },
        { status: 403 }
      );
    }

    const creds = user.organizations.agillic_credentials;
    if (!creds?.staging_key) {
      return NextResponse.json(
        { error: "Agillic API credentials not configured" },
        { status: 400 }
      );
    }

    const agillicClient = createStagingClient(creds);
    const gdtClient = new GlobalDataAPIClient(agillicClient);
    const tables = await gdtClient.listTables();

    return NextResponse.json(tables);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
