import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Samvel Kerobyan",
  description: "Engineering projects by Samvel Kerobyan.",
  authors: [{ name: "Samvel Kerobyan" }],
};

export const viewport: Viewport = {
  // Light-only by design: every animation frame and CAD render is on white, so a
  // dark theme would mean re-rendering all the media.
  colorScheme: "light",
  themeColor: "#fcfcfd",
};

// Explicit props rather than Next's generated `LayoutProps<"/">`: that global only
// exists once .next/types has been produced, so using it breaks a bare `tsc --noEmit`.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
