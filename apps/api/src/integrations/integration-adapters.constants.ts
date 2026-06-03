export type IntegrationCredentialField = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
};

export type IntegrationAdapterDefinition = {
  key: string;
  name: string;
  description: string;
  credentialFields: IntegrationCredentialField[];
  supportedEvents: string[];
};

export const INTEGRATION_ADAPTERS: IntegrationAdapterDefinition[] = [
  {
    key: "generic_webhook",
    name: "Generic webhook",
    description:
      "Receive arbitrary JSON payloads and log them for debugging. No side effects.",
    credentialFields: [],
    supportedEvents: ["*"],
  },
  {
    key: "channel_manager",
    name: "Channel manager",
    description:
      "Export nightly availability by room type and import OTA bookings as INQUIRY reservations.",
    credentialFields: [
      { key: "partnerId", label: "Partner ID", secret: false, required: false },
      { key: "apiKey", label: "API key", secret: true, required: false },
    ],
    supportedEvents: ["booking.import"],
  },
  {
    key: "ota_inquiry",
    name: "OTA inquiry (legacy)",
    description: "Alias for channel manager — use channel_manager for new connections.",
    credentialFields: [
      { key: "partnerId", label: "Partner ID", secret: false, required: false },
      { key: "apiKey", label: "API key", secret: true, required: false },
    ],
    supportedEvents: ["booking.import"],
  },
];

export function getIntegrationAdapter(key: string): IntegrationAdapterDefinition | undefined {
  return INTEGRATION_ADAPTERS.find((a) => a.key === key);
}
