/**
 * Agillic integration — barrel export.
 */

export { AgillicClient, createAgillicClient, createStagingClient, createProductionClient } from "./client";
export type { AgillicCredentials, AgillicOrgCredentials } from "./client";

export { MessageAPIClient } from "./message-api";
export type {
  StagePayload,
  BlockGroup,
  BlockMessage,
  MessageVariant,
  StageResponse,
  TaskStatus,
  TestResponse,
} from "./message-api";

export { AssetsAPIClient } from "./assets-api";

export { RecipientsAPIClient } from "./recipients-api";
export type { AgillicRecipient, RecipientPage } from "./recipients-api";

export { DiscoveryAPIClient } from "./discovery-api";
export type { PersonDataField } from "./discovery-api";

export { GlobalDataAPIClient } from "./globaldata-api";

export {
  convertLiquidToAgillic,
  convertAgillicToLiquid,
  DEFAULT_FIELD_MAP,
} from "./variable-map";
