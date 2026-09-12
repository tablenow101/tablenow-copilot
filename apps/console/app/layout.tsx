import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./stitch.css";

export const metadata: Metadata = {
  title: "TableNow Copilot",
  description: "Le centre de commandement opérationnel du restaurant.",
  robots: { index: false, follow: false, noarchive: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0f15",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
