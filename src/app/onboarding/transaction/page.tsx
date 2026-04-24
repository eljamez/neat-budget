"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { TransactionForm } from "./TransactionForm";

export default function TransactionPage() {
  const router = useRouter();
  const { state, isLoading } = useOnboarding();

  useEffect(() => {
    if (isLoading) return;
    if (!state) {
      router.replace("/onboarding");
      return;
    }
    if (state.step === "done") {
      router.replace("/dashboard");
    }
  }, [state, isLoading, router]);

  if (isLoading || !state) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return <TransactionForm />;
}
