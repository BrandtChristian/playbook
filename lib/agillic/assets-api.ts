/**
 * Agillic Assets API client — upload email templates and images.
 */

import type { AgillicClient } from "./client";

export class AssetsAPIClient {
  private client: AgillicClient;

  constructor(client: AgillicClient) {
    this.client = client;
  }

  /**
   * Upload or update an email HTML template in Agillic.
   * Uses PUT so it creates or overwrites if exists.
   */
  async uploadTemplate(
    html: string,
    filename: string,
    folder?: string
  ): Promise<void> {
    const buffer = Buffer.from(html, "utf-8");
    await this.client.uploadFile(
      "/assets/templates",
      buffer,
      filename,
      folder,
      "PUT"
    );
  }

  /**
   * Upload or update an image resource in Agillic.
   */
  async uploadImage(
    imageBuffer: Buffer | Uint8Array,
    filename: string,
    folder: string = "Forge/images"
  ): Promise<void> {
    await this.client.uploadFile(
      "/assets/resources",
      imageBuffer,
      filename,
      folder,
      "PUT"
    );
  }
}
