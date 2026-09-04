import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Open_Sans } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-open-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Rawia Battle",
  description: "Rawia Cafe — refuel. relish. revive. The live in-store battle.",
  robots: { index: false, follow: false },
  icons: { icon: "/rawia-mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5f0e8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${openSans.variable} ${plexMono.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
