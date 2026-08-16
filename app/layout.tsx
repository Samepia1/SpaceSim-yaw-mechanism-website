import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Independent Yaw Mechanism for a Cable-Driven Parallel Robot",
  description:
    "A yaw mechanism that lets a cable-driven parallel robot rotate its payload " +
    "continuously instead of stopping at 30–40°, from bench prototype to a " +
    "full-scale design built almost entirely from stock parts.",
  authors: [{ name: "Samvel Kerobyan" }],
  openGraph: {
    title: "Independent Yaw Mechanism for a Cable-Driven Parallel Robot",
    description:
      "Interactive 3D models and scroll-driven animations of the mechanism, " +
      "from prototype to full scale. ARDC Lab, University of Minnesota.",
    type: "website",
  },
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
