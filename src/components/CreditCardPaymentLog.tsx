"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatShortDate } from "@/lib/utils";
import { useTransactionModal } from "@/components/TransactionModalProvider";

export function CreditCardPaymentLog({ creditCardId }: { creditCardId: Id<"creditCards"> }) {
  const { openEditTransaction } = useTransactionModal();
  const payments = useQuery(api.transactions.listByCreditCard, { creditCardId });

  if (payments === undefined) {
    return (
      <div className="space-y-2 py-2">
        <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">
        No recorded payments yet. Log a transaction and link this card to reduce the balance.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 max-h-40 overflow-y-auto">
      {payments.map((tx) => (
        <li key={tx._id}>
          <button
            type="button"
            onClick={() => openEditTransaction(tx)}
            className="flex w-full items-center justify-between gap-2 text-xs bg-white border border-slate-100 rounded-lg px-2 py-1.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span className="text-slate-600 truncate min-w-0">{tx.description}</span>
            <span className="text-slate-400 shrink-0">{formatShortDate(tx.date)}</span>
            <span className="font-semibold text-slate-800 shrink-0 tabular-nums">
              {formatCurrency(tx.amount)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
