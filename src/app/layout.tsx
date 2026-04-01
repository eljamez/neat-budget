import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConvexClerkProvider } from "@/components/providers/ConvexClerkProvider";
import { Sidebar } from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Neat Budget - Personal Budgeting",
  description: "Take control of your finances with real-time budget tracking",
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
    <html lang="en">
      <body className={`${geist.className} bg-slate-50`}>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ConvexClerkProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main id="main-content" className="flex-1 min-w-0 w-full p-5 pt-[5.5rem] pb-24 lg:p-8 lg:pt-8 lg:pb-8" tabIndex={-1}>
              {children}
            </main>
          </div>
        </ConvexClerkProvider>
      </body>
    </html>
  );
}
