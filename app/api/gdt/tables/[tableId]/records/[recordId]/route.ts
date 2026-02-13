import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createStagingClient, GlobalDataAPIClient } from "@/lib/agillic";

async function getGdtClient() {
  const user = await getCurrentUser();

  if (user.organizations.email_provider !== "agillic") {
    throw new Error("FORBIDDEN");
  }

  const creds = user.organizations.agillic_credentials;
  if (!creds?.staging_key) {
    throw new Error("NO_CREDENTIALS");
  }

  const agillicClient = createStagingClient(creds);
  return new GlobalDataAPIClient(agillicClient);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  try {
    const { tableId, recordId } = await params;

    if (!tableId || !recordId) {
      return NextResponse.json(
        { error: "Table ID and Record ID are required" },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const gdtClient = await getGdtClient();

    const decodedTableId = decodeURIComponent(tableId);
    const decodedRecordId = decodeURIComponent(recordId);

    await gdtClient.updateRecord(decodedTableId, decodedRecordId, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "GDT Editor is only available for Agillic organizations" },
        { status: 403 }
      );
    }
    if (message === "NO_CREDENTIALS") {
      return NextResponse.json(
        { error: "Agillic API credentials not configured" },
        { status: 400 }
      );
    }
    if (message.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  try {
    const { tableId, recordId } = await params;

    if (!tableId || !recordId) {
      return NextResponse.json(
        { error: "Table ID and Record ID are required" },
        { status: 400 }
      );
    }

    const gdtClient = await getGdtClient();

    const decodedTableId = decodeURIComponent(tableId);
    const decodedRecordId = decodeURIComponent(recordId);

    await gdtClient.deleteRecord(decodedTableId, decodedRecordId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "GDT Editor is only available for Agillic organizations" },
        { status: 403 }
      );
    }
    if (message === "NO_CREDENTIALS") {
      return NextResponse.json(
        { error: "Agillic API credentials not configured" },
        { status: 400 }
      );
    }
    if (message.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
