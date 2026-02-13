import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { createStagingClient, GlobalDataAPIClient } from "@/lib/agillic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;

    if (!tableId) {
      return NextResponse.json(
        { error: "Table ID is required" },
        { status: 400 }
      );
    }

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

    const decodedTableId = decodeURIComponent(tableId);

    const [tableData, metadata] = await Promise.all([
      gdtClient.getTable(decodedTableId),
      gdtClient.getTableMetadata(decodedTableId),
    ]);

    return NextResponse.json({
      name: metadata.name || tableData.name,
      description: metadata.description,
      fields: metadata.fields,
      records: tableData.records,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }
    if (message.includes("404")) {
      return NextResponse.json(
        { error: "Table not found in Agillic" },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params;

    if (!tableId) {
      return NextResponse.json(
        { error: "Table ID is required" },
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

    const decodedTableId = decodeURIComponent(tableId);
    await gdtClient.createRecord(decodedTableId, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("timeout")) {
      return NextResponse.json({ error: "Request timeout" }, { status: 504 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
