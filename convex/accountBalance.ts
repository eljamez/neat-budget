import type { Doc } from "./_generated/dataModel";

/** How a positive spend amount moves the stored balance for this account type. */
export function balanceDeltaForSpend(
  accountType: Doc<"accounts">["accountType"],
  spendAmount: number
): number {
  if (accountType === "credit_card") {
    return spendAmount;
  }
  return -spendAmount;
}
