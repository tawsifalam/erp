/** Adapters that support channel manager (availability export + booking import). */
export const CHANNEL_ADAPTER_KEYS = ["channel_manager", "ota_inquiry"] as const;

export type ChannelAdapterKey = (typeof CHANNEL_ADAPTER_KEYS)[number];

export function isChannelAdapter(adapterKey: string): boolean {
  return (CHANNEL_ADAPTER_KEYS as readonly string[]).includes(adapterKey);
}
