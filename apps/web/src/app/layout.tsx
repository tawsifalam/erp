import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Hospitality ERP",
  description: "Multi-tenant hospitality ERP/PMS",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
