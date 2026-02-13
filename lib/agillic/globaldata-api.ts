/**
 * Agillic Global Data API client — CRUD on Global Data Tables.
 * Ported from Bifrost GlobalDataAPIClient.
 */

import type { AgillicClient } from "./client";

export interface GdtFieldMetadata {
  name: string;
  type: "STRING" | "NUMBER" | "BOOLEAN" | "DATE" | "TIMESTAMP";
  identifier?: boolean;
  index?: "NO_INDEX" | "INDEXED" | "UNIQUE";
  description?: string;
}

export interface GdtTableMetadata {
  name: string;
  description?: string;
  fields: GdtFieldMetadata[];
}

export interface GdtTableData {
  name: string;
  records: Record<string, string>[];
}

export class GlobalDataAPIClient {
  private client: AgillicClient;

  constructor(client: AgillicClient) {
    this.client = client;
  }

  async listTables(): Promise<string[]> {
    return this.client.request<string[]>("/globaldata/tables");
  }

  async getTable(tableId: string): Promise<GdtTableData> {
    return this.client.request<GdtTableData>(
      `/globaldata/tables/${encodeURIComponent(tableId)}`
    );
  }

  async getTableMetadata(tableId: string): Promise<GdtTableMetadata> {
    return this.client.request<GdtTableMetadata>(
      `/discovery/globaldata/tables/${encodeURIComponent(tableId)}`
    );
  }

  async createRecord(
    tableId: string,
    data: Record<string, string>
  ): Promise<void> {
    await this.client.request<void>(
      `/globaldata/tables/${encodeURIComponent(tableId)}/record`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async updateRecord(
    tableId: string,
    recordId: string,
    data: Record<string, string>
  ): Promise<void> {
    await this.client.request<void>(
      `/globaldata/tables/${encodeURIComponent(tableId)}/record/${encodeURIComponent(recordId)}`,
      { method: "PUT", body: JSON.stringify(data) }
    );
  }

  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    await this.client.request<void>(
      `/globaldata/tables/${encodeURIComponent(tableId)}/record/${encodeURIComponent(recordId)}`,
      { method: "DELETE" }
    );
  }
}
