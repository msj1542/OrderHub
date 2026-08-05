import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ordering Hub",
  description: "Hogskins B2B order, fulfillment, and tracking platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
