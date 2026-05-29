import { Text } from "@chakra-ui/react";

export function MoneyText({ amount, currency = "USD" }: { amount: number; currency?: string }) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
  return <Text fontWeight="medium">{formatted}</Text>;
}
