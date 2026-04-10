import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConvexClerkProvider } from "@/components/providers/ConvexClerkProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/AppShell";

const geist = Geist({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Neat Budget - Personal Budgeting",
  description: "Plan monthly funding for recurring bills, buckets, debts, and cards.",
  icons: {
    // SVG icon for modern desktop browsers (Chrome 80+, Firefox 41+, Safari 12+)
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-background text-foreground`}>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ThemeProvider>
          <ConvexClerkProvider>
            <AppShell>{children}</AppShell>
          </ConvexClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
