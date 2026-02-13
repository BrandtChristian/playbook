/**
 * Agillic Decentralised Messaging API client.
 * Ported from Bifrost MessageAPIClient, adapted for Forge's template-upload model.
 */

import type { AgillicClient } from "./client";

export interface StagePayload {
  name: string;
  subject: string;
  templateName: string;
  targetGroupName: string;
  schedule?: string;
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
  utmCampaign?: string;
  limitToTargetGroupName?: string;
  flowTemplate?: string;
  blockGroups: BlockGroup[];
}

export interface BlockGroup {
  blockGroupId: string;
  messages: BlockMessage[];
}

export interface BlockMessage {
  name: string;
  messageTemplate: string;
  blockId: string;
  maxVariants?: number;
  collapsed?: boolean;
  variants: MessageVariant[];
}

export interface MessageVariant {
  name: string;
  targetGroupName?: string;
  fields: Record<string, string>;
}

export interface StageResponse {
  taskId: string;
}

export interface TaskStatus {
  taskId: string;
  status: "completed" | "failed" | "pending" | "running";
  details?: { result: string };
}

export interface TestResponse {
  success: boolean;
  message: string;
  data?: {
    subject: string;
    content: string;
  };
}

export class MessageAPIClient {
  private client: AgillicClient;

  constructor(client: AgillicClient) {
    this.client = client;
  }

  /**
   * Stage (create) a new campaign via V2. Async — returns a taskId only.
   */
  async stageCampaign(payload: StagePayload): Promise<StageResponse> {
    return this.client.request<StageResponse>(
      "/messages/v2/campaign/email/:stage",
      {
        method: "POST",
        body: JSON.stringify({
          details: payload,
        }),
      }
    );
  }

  /**
   * Stage (create) a new campaign via V1. Synchronous — returns campaignId directly.
   * Ported from Bifrost. Use this when you need the campaign ID for testing.
   */
  async stageCampaignV1(
    payload: StagePayload
  ): Promise<{ campaignId: string; campaignName: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.client.request<any>(
      "/messages/v1/campaign/email/:stage",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    const campaignId =
      result?.data?.campaignId || result?.campaignId || result?.id;

    if (!campaignId) {
      throw new Error(
        "No campaignId returned from V1 stage: " + JSON.stringify(result)
      );
    }

    return {
      campaignId,
      campaignName: payload.name,
    };
  }

  /**
   * Edit an existing campaign. Async — returns a taskId.
   */
  async editCampaign(
    campaignId: string,
    payload: Omit<StagePayload, "name" | "templateName" | "blockGroups"> & {
      blockGroups: EditBlockGroup[];
    }
  ): Promise<StageResponse> {
    return this.client.request<StageResponse>(
      "/messages/v2/campaign/email/:edit",
      {
        method: "POST",
        body: JSON.stringify({
          details: {
            campaignId,
            ...payload,
          },
        }),
      }
    );
  }

  /**
   * Publish a staged campaign. Async — returns a taskId.
   */
  async publishCampaign(campaignId: string): Promise<StageResponse> {
    return this.client.request<StageResponse>(
      "/messages/v2/campaign/email/:publish",
      {
        method: "POST",
        body: JSON.stringify({ campaignId }),
      }
    );
  }

  /**
   * Test a staged campaign. Synchronous.
   * Requires the campaign to be staged first (with 2-5s propagation delay).
   */
  async testCampaign(
    campaignId: string,
    recipientId: string,
    sendMessage: boolean = true
  ): Promise<TestResponse> {
    return this.client.request<TestResponse>(
      "/messages/v1/campaign/email/:test",
      {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          viewAsRecipientId: recipientId,
          sendMessage: sendMessage ? "true" : "false",
        }),
      }
    );
  }

  /**
   * Check the status of an async task (stage/edit/publish).
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    return this.client.request<TaskStatus>(`/messages/v2/task/${taskId}`);
  }

  /**
   * Stage a test campaign and send a test email.
   * Creates a uniquely-named campaign, waits for propagation, then tests.
   */
  async stageAndTest(
    payload: StagePayload,
    recipientId: string
  ): Promise<TestResponse> {
    // Stage with a unique name for the test
    const stageResult = await this.stageCampaign(payload);

    // Wait for propagation (known Agillic quirk: 5s)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Poll for task completion
    let attempts = 0;
    while (attempts < 10) {
      const status = await this.getTaskStatus(stageResult.taskId);
      if (status.status === "completed") break;
      if (status.status === "failed") {
        throw new Error("Campaign staging failed in Agillic");
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // The campaignId for test is the campaign name
    return this.testCampaign(payload.name, recipientId, true);
  }
}

/**
 * Edit block groups don't include messageTemplate or blockId.
 */
export interface EditBlockGroup {
  messages: EditBlockMessage[];
}

export interface EditBlockMessage {
  name: string;
  maxVariants?: number;
  collapsed?: boolean;
  variants: MessageVariant[];
}
