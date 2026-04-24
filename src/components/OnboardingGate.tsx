"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";

const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"];

export function OnboardingGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  const { state, isLoading } = useOnboarding(user?.id);
  const start = useMutation(api.onboarding.start);

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return;
    if (!user) return;
    if (isLoading || state === undefined) return;

    if (!state.startedAt) {
      start({ userId: user.id }).catch(console.error);
      return;
    }

    const isOnboarding = pathname.startsWith("/onboarding");
    const isDone = state.step === "done";

    if (!isDone && !isOnboarding) {
      router.replace("/onboarding");
    } else if (isDone && isOnboarding) {
      router.replace("/dashboard");
    }
  }, [state, isLoading, pathname, router, start, user]);

  return null;
}
