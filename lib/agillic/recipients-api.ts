/**
 * Agillic Recipients API client — read-only recipient operations.
 */

import type { AgillicClient } from "./client";

export interface AgillicRecipient {
  personData: Record<string, string>;
}

export interface RecipientPage {
  content: AgillicRecipient[];
  page: {
    pageSize: number;
    pageStart: number;
    totalPages: number;
    totalElements: number;
    documentId?: string;
  };
}

export class RecipientsAPIClient {
  private client: AgillicClient;

  constructor(client: AgillicClient) {
    this.client = client;
  }

  /**
   * Get a single recipient by their identifier (e.g., email).
   * Uses the format: /recipients/EMAIL=user@example.com
   */
  async getByEmail(email: string): Promise<AgillicRecipient | null> {
    try {
      return await this.client.request<AgillicRecipient>(
        `/recipients/EMAIL=${encodeURIComponent(email)}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get a single recipient by their Recipient ID.
   */
  async getById(recipientId: string): Promise<AgillicRecipient | null> {
    try {
      return await this.client.request<AgillicRecipient>(
        `/recipients/${encodeURIComponent(recipientId)}`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List recipients with optional RSQL filter, paginated.
   * Example filter: "FIRSTNAME==John and AGE>=18"
   */
  async list(
    filter?: string,
    pageSize: number = 100,
    pageStart: number = 1,
    documentId?: string
  ): Promise<RecipientPage> {
    const params = new URLSearchParams({
      objectResponse: "true",
      pageSize: String(pageSize),
      pageStart: String(pageStart),
    });

    if (filter) params.set("filter", filter);
    if (documentId) params.set("documentId", documentId);

    return this.client.request<RecipientPage>(
      `/recipients?${params.toString()}`
    );
  }

  /**
   * Search recipients by a text query across common fields.
   */
  async search(
    query: string,
    pageSize: number = 50
  ): Promise<RecipientPage> {
    const filter = `EMAIL==*${query}* or FIRSTNAME==*${query}* or LASTNAME==*${query}*`;
    return this.list(filter, pageSize);
  }
}
