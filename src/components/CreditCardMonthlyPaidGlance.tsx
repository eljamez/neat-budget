"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatShortDate } from "@/lib/utils";

const GLANCE_MONTHS = 8;

/**
 * Latest logged payment date per calendar month (recent months first), for a quick on-card glance.
 */
export function CreditCardMonthlyPaidGlance({ creditCardId }: { creditCardId: Id<"creditCards"> }) {
  const { user } = useUser();
  const txs = useQuery(
    api.transactions.listByCreditCard,
    user ? { userId: user.id, creditCardId } : "skip"
  );

  const phrase = useMemo(() => {
    if (!txs) return null;
    const byMonth = new Map<string, string>();
    for (const tx of txs) {
      if (tx.amount <= 0) continue;
      const monthKey = tx.date.slice(0, 7);
      const prev = byMonth.get(monthKey);
      if (!prev || tx.date > prev) {
        byMonth.set(monthKey, tx.date);
      }
    }
    const sorted = [...byMonth.entries()].sort(([a], [b]) => b.localeCompare(a));
    return sorted
      .slice(0, GLANCE_MONTHS)
      .map(([, iso]) => formatShortDate(iso))
      .join(" · ");
  }, [txs]);

  if (txs === undefined) {
    return <span className="text-slate-400">…</span>;
  }
  if (!phrase) {
    return <span className="text-slate-400">No payments logged</span>;
  }
  return <span className="text-slate-600 tabular-nums">{phrase}</span>;
}
