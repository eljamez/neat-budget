"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function OnboardingIndexPage() {
  const router = useRouter();
  const { user } = useUser();
  const { state, isLoading } = useOnboarding(user?.id);
  const start = useMutation(api.onboarding.start);

  useEffect(() => {
    if (isLoading) return;

    if (!state || !state.startedAt) {
      start({ userId: user?.id }).catch(console.error);
      return;
    }

    switch (state.step) {
      case "account":
        router.replace("/onboarding/account");
        break;
      case "category":
        router.replace("/onboarding/category");
        break;
      case "fund":
        router.replace("/onboarding/fund");
        break;
      case "transaction":
        router.replace("/onboarding/transaction");
        break;
      case "done":
        router.replace("/dashboard");
        break;
    }
  }, [state, isLoading, router, start]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
    </div>
  );
}
