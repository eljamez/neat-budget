"use client";

import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type OnboardingStep = "account" | "category" | "fund" | "transaction" | "done";

export type OnboardingState = {
  step: OnboardingStep;
  startedAt: number;
  completedAt?: number;
  accountId?: Id<"accounts">;
  categoryId?: Id<"categories">;
};

export function useOnboarding(): {
  state: OnboardingState | undefined;
  isLoading: boolean;
  advance: (to: OnboardingStep) => Promise<void>;
  setAccountId: (id: Id<"accounts">) => Promise<void>;
  setCategoryId: (id: Id<"categories">) => Promise<void>;
  complete: () => Promise<void>;
} {
  const { isAuthenticated } = useConvexAuth();
  const raw = useQuery(api.onboarding.getState, isAuthenticated ? {} : "skip");
  const advanceMut = useMutation(api.onboarding.advance);
  const setAccountIdMut = useMutation(api.onboarding.setAccountId);
  const setCategoryIdMut = useMutation(api.onboarding.setCategoryId);
  const completeMut = useMutation(api.onboarding.complete);

  const isLoading = raw === undefined;

  const state: OnboardingState | undefined =
    raw === undefined || raw === null
      ? undefined
      : {
          step: raw.step as OnboardingStep,
          startedAt: raw.startedAt,
          completedAt: raw.completedAt,
          accountId: raw.accountId,
          categoryId: raw.categoryId,
        };

  return {
    state,
    isLoading,
    advance: async (to) => { await advanceMut({ step: to }); },
    setAccountId: async (id) => { await setAccountIdMut({ accountId: id }); },
    setCategoryId: async (id) => { await setCategoryIdMut({ categoryId: id }); },
    complete: async () => { await completeMut({}); },
  };
}
