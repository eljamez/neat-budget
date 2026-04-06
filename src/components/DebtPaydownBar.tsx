"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, getProgressColor, getProgressTextColor } from "@/lib/utils";

function totalPaidFromTxs(txs: { amount: number }[]) {
  let s = 0;
  for (const t of txs) {
    if (t.amount > 0) s += t.amount;
  }
  return s;
}

export function DebtPaydownBar({
  debtId,
  currentBalance,
  originalLoanAmount,
}: {
  debtId: Id<"debts">;
  currentBalance: number;
  originalLoanAmount?: number | null;
}) {
  const txs = useQuery(api.transactions.listByDebt, { debtId });

  const hasOriginal =
    originalLoanAmount != null && originalLoanAmount > 0.005;

  const computed = useMemo(() => {
    const orig = originalLoanAmount ?? 0;
    if (orig > 0.005) {
      const raw = Math.min(100, Math.max(0, (currentBalance / orig) * 100));
      const rounded = Math.round(raw * 10) / 10;
      const principalPaid = Math.max(0, orig - currentBalance);
      return {
        remainingPct: raw,
        labelRemain: rounded,
        paidDisplay: principalPaid,
        paidSuffix: "paydown vs original" as const,
      };
    }
    if (txs === undefined) {
      return null;
    }
    const paidFromTx = totalPaidFromTxs(txs);
    const denom = currentBalance + paidFromTx;
    if (denom <= 0.005) {
      return {
        remainingPct: 0,
        labelRemain: 0,
        paidDisplay: paidFromTx,
        paidSuffix: "logged" as const,
      };
    }
    const raw = Math.min(100, Math.max(0, (currentBalance / denom) * 100));
    const rounded = Math.round(raw * 10) / 10;
    return {
      remainingPct: raw,
      labelRemain: rounded,
      paidDisplay: paidFromTx,
      paidSuffix: "logged" as const,
    };
  }, [txs, currentBalance, originalLoanAmount]);

  if (txs === undefined && !hasOriginal) {
    return (
      <div className="mt-1.5">
        <div className="h-1.5 w-full rounded-full bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (computed == null) {
    return null;
  }

  const { remainingPct, labelRemain, paidDisplay, paidSuffix } = computed;
  const barClass = getProgressColor(remainingPct);
  const textClass = getProgressTextColor(remainingPct);
  const widthPct = `${Math.min(100, remainingPct)}%`;

  return (
    <div className="mt-1.5 space-y-0.5">
      <div
        className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
        role="img"
        aria-label={`${formatCurrency(currentBalance)} remaining, ${labelRemain}% of loan left to pay off`}
      >
        <div className={`h-full rounded-full transition-[width] ${barClass}`} style={{ width: widthPct }} />
      </div>
      <p className={`text-sm font-medium tabular-nums ${textClass}`}>
        {formatCurrency(currentBalance)} · {labelRemain}% to pay off
        {paidDisplay > 0.005 && (
          <span className="text-slate-500 font-normal">
            {" "}
            · {formatCurrency(paidDisplay)}{" "}
            {paidSuffix === "paydown vs original" ? "vs original" : "logged"}
          </span>
        )}
      </p>
    </div>
  );
}
