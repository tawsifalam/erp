import { Box, Button, Heading, Text, Stack } from "@chakra-ui/react";
import Link from "next/link";

export default function HomePage() {
  return (
    <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" bg="gray.50">
      <Stack gap={6} textAlign="center" p={8}>
        <Heading size="2xl">Hospitality ERP</Heading>
        <Text color="fg.muted" maxW="md">
          PMS, POS, inventory ledger, accounting, and HR in one platform.
        </Text>
        <Stack direction="row" justify="center" gap={4}>
          <Button asChild colorPalette="blue">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
