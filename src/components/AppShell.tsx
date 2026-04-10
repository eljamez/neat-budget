"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        id="main-content"
        className={cn(
          "flex-1 min-w-0 w-full",
          isHome
            ? "p-5 lg:p-8 pb-8"
            : "bg-background p-5 pt-[5.5rem] pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:p-8 lg:pt-8 lg:pb-8"
        )}
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
