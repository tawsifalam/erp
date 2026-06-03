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
    key: "ota_inquiry",
    name: "OTA inquiry (stub)",
    description:
      "Import channel bookings as PMS INQUIRY reservations. MVP stub for channel manager.",
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
