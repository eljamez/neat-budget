"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"];
const DONE_FLAG = "nb_onboarding_done";

function getLocalDoneFlag(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DONE_FLAG) === "1";
}

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { state, isLoading } = useOnboarding(user?.id);
  const start = useMutation(api.onboarding.start);

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isOnboardingPath = pathname.startsWith("/onboarding");
  const isDone = state?.step === "done";

  // Persist completion so returning users skip the overlay on subsequent loads.
  useEffect(() => {
    if (isDone) localStorage.setItem(DONE_FLAG, "1");
  }, [isDone]);

  // Show a blocking overlay on protected routes while we're determining where the user
  // belongs. This prevents a flash of the dashboard before a redirect to /onboarding fires.
  // Skip the overlay for users who are known-done via the local flag — they won't be
  // redirected, so there's no reason to block their content.
  const showOverlay =
    !isPublicPath &&
    !isOnboardingPath &&
    !getLocalDoneFlag() &&
    (!isUserLoaded || isLoading || (!!user && !isDone));

  useEffect(() => {
    if (isPublicPath) return;
    if (!user) return;
    if (isLoading) return;

    if (state === undefined) {
      if (!isOnboardingPath) {
        router.replace("/onboarding");
      }
      return;
    }

    if (!state.startedAt) {
      start({ userId: user.id }).catch(console.error);
      return;
    }

    if (!isDone && !isOnboardingPath) {
      router.replace("/onboarding");
    } else if (isDone && isOnboardingPath) {
      router.replace("/dashboard");
    }
  }, [state, isLoading, isOnboardingPath, isPublicPath, isDone, router, start, user]);

  if (!showOverlay) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] bg-background flex items-center justify-center"
    >
      <div className="w-8 h-8 rounded-full border-2 border-teal-600/30 border-t-teal-600 animate-spin" />
    </div>
  );
}
