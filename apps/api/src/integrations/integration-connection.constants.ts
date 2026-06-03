export const IntegrationConnectionStatus = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type IntegrationConnectionStatusValue =
  (typeof IntegrationConnectionStatus)[keyof typeof IntegrationConnectionStatus];

export const IntegrationWebhookEventStatus = {
  RECEIVED: "RECEIVED",
  PROCESSED: "PROCESSED",
  FAILED: "FAILED",
} as const;

export type IntegrationWebhookEventStatusValue =
  (typeof IntegrationWebhookEventStatus)[keyof typeof IntegrationWebhookEventStatus];
