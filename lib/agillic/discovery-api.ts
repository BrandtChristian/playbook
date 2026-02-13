/**
 * Agillic Discovery API client — introspect data structure definitions.
 */

import type { AgillicClient } from "./client";

export interface PersonDataField {
  name: string;
  type: "STRING" | "NUMBER";
  identifier?: boolean;
}

export interface OtmTableField {
  name: string;
  type: "STRING" | "NUMBER";
  identifier?: boolean;
}

export interface OtmTableSchema {
  name: string;
  fields: OtmTableField[];
}

export interface GlobalDataVariable {
  NAME: string;
  TYPE: "STRING" | "NUMBER";
  DESCRIPTION?: string;
}

export interface GdtTableSchema {
  name: string;
  description?: string;
  fields: OtmTableField[];
}

export interface AgillicTargetGroup {
  name: string;
  description: string;
  static: boolean;
}

export class DiscoveryAPIClient {
  private client: AgillicClient;

  constructor(client: AgillicClient) {
    this.client = client;
  }

  /**
   * Get all Person Data field definitions (the "schema" of recipients).
   * Response is { name: "Person Data", fields: [...] } — we extract the fields array.
   */
  async getPersonData(): Promise<PersonDataField[]> {
    const response = await this.client.request<{ fields: PersonDataField[] } | PersonDataField[]>(
      "/discovery/persondata"
    );
    // API returns { fields: [...] } wrapper, not a bare array
    if (Array.isArray(response)) return response;
    return response?.fields ?? [];
  }

  /**
   * Find the Recipient ID field (the one with identifier: true).
   */
  async getRecipientIdField(): Promise<PersonDataField | undefined> {
    const fields = await this.getPersonData();
    if (!Array.isArray(fields)) return undefined;
    return fields.find((f) => f.identifier === true);
  }

  /**
   * List all One-to-Many table names.
   */
  async listOtmTables(): Promise<string[]> {
    return this.client.request<string[]>("/discovery/onetomany");
  }

  /**
   * Get the schema (fields) of a One-to-Many table.
   */
  async getOtmTableSchema(tableName: string): Promise<OtmTableSchema> {
    return this.client.request<OtmTableSchema>(
      `/discovery/onetomany/${encodeURIComponent(tableName)}`
    );
  }

  /**
   * List all Global Data variables.
   */
  async listGlobalData(): Promise<GlobalDataVariable[]> {
    return this.client.request<GlobalDataVariable[]>("/discovery/globaldata/");
  }

  /**
   * List all Global Data Table names.
   */
  async listGdtTables(): Promise<string[]> {
    return this.client.request<string[]>("/discovery/globaldata/tables");
  }

  /**
   * Get the schema of a Global Data Table.
   */
  async getGdtTableSchema(tableName: string): Promise<GdtTableSchema> {
    return this.client.request<GdtTableSchema>(
      `/discovery/globaldata/tables/${encodeURIComponent(tableName)}`
    );
  }

  /**
   * List all Target Groups in the Agillic instance.
   * Returns name, description, and whether the group is static.
   * Should be called with PRODUCTION credentials.
   */
  async listTargetGroups(): Promise<AgillicTargetGroup[]> {
    return this.client.request<AgillicTargetGroup[]>("/discovery/targetgroups");
  }
}
