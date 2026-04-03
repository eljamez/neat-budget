"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard } from "lucide-react";

type HomeAccountHeaderProps = {
  isSignedIn: boolean;
};

export function HomeAccountHeader({ isSignedIn }: HomeAccountHeaderProps) {
  if (!isSignedIn) return null;

  return (
    <div className="absolute top-6 right-5 sm:right-8 z-10 flex items-center gap-2 sm:gap-3">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-3 py-2 sm:px-4 transition-colors"
      >
        <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />
        Dashboard
      </Link>
      <UserButton />
    </div>
  );
}
