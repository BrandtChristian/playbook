/**
 * Agillic API base client with authentication and request handling.
 */

const API_BASE = "https://api-eu1.agillic.net";
const REQUEST_TIMEOUT = 30_000;

export interface AgillicCredentials {
  api_key: string;
  api_secret: string;
  instance_url: string;
}

/**
 * Full credential set stored per-org in agillic_credentials JSONB.
 * Staging credentials for creating/testing campaigns.
 * Production credentials for publishing and target group discovery.
 */
export interface AgillicOrgCredentials {
  staging_key: string;
  staging_secret: string;
  staging_url: string;   // e.g. https://customer-stag.agillic.eu
  prod_key: string;
  prod_secret: string;
  prod_url: string;      // e.g. https://customer-prod.agillic.eu
}

export class AgillicClient {
  private credentials: AgillicCredentials;

  constructor(credentials: AgillicCredentials) {
    this.credentials = credentials;
  }

  get instanceUrl(): string {
    return this.credentials.instance_url;
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(`${this.credentials.api_key}:${this.credentials.api_secret}`).toString("base64")}`;
  }

  async request<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          Authorization: this.getAuthHeader(),
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json; charset=utf-8",
          ...options?.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Agillic API error ${response.status}: ${errorText}`
        );
      }

      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Agillic API timeout (30s)");
      }
      throw error;
    }
  }

  /**
   * Upload a file (multipart/form-data) — used by Assets API.
   */
  async uploadFile(
    path: string,
    file: Buffer | Uint8Array,
    filename: string,
    folder?: string,
    method: "POST" | "PUT" = "PUT"
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(file)]), filename);
    if (folder) formData.append("folder", folder);

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: this.getAuthHeader(),
          Accept: "application/json; charset=utf-8",
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Agillic upload error ${response.status}: ${errorText}`
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Agillic upload timeout (30s)");
      }
      throw error;
    }
  }

  /**
   * Validate credentials by calling the Discovery API.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("/discovery/persondata");
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create an Agillic client from simple credentials.
 */
export function createAgillicClient(
  credentials: AgillicCredentials
): AgillicClient {
  return new AgillicClient(credentials);
}

/**
 * Create a staging client from org credentials.
 * Used for: staging campaigns, testing, editing.
 */
export function createStagingClient(
  creds: AgillicOrgCredentials
): AgillicClient {
  return new AgillicClient({
    api_key: creds.staging_key,
    api_secret: creds.staging_secret,
    instance_url: creds.staging_url,
  });
}

/**
 * Create a production client from org credentials.
 * Used for: publishing campaigns, target group discovery.
 */
export function createProductionClient(
  creds: AgillicOrgCredentials
): AgillicClient {
  return new AgillicClient({
    api_key: creds.prod_key,
    api_secret: creds.prod_secret,
    instance_url: creds.prod_url,
  });
}
