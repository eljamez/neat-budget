"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatAccountType } from "@/lib/utils";

type FundingRow = {
  _id: Id<"bucketMonthFundings">;
  bucketId: Id<"buckets">;
  accountId?: Id<"accounts">;
  amount: number;
};

type AccountOption = {
  _id: Id<"accounts">;
  name: string;
  accountType: string;
};

interface BucketFundingModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  monthKey: string;
  bucketId: Id<"buckets">;
  bucketName: string;
  /** Max cash funded for this bucket this month (monthly fill goal or spending target). */
  monthlyFundingCap: number;
  /** Spending allowance shown for context (target amount). */
  spendTarget: number;
  fundings: FundingRow[];
  /** Used only to label legacy funding rows that still store `accountId`. */
  accounts?: AccountOption[];
}

export function BucketFundingModal({
  open,
  onClose,
  userId,
  monthKey,
  bucketId,
  bucketName,
  monthlyFundingCap,
  spendTarget,
  fundings,
  accounts,
}: BucketFundingModalProps) {
  const createFunding = useMutation(api.bucketMonthFundings.create);
  const removeFunding = useMutation(api.bucketMonthFundings.remove);
  const removeAllForMonth = useMutation(api.bucketMonthFundings.removeAllForBucketMonth);

  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearAllLoading, setClearAllLoading] = useState(false);
  const [error, setError] = useState("");

  const lines = fundings.filter((f) => f.bucketId === bucketId);
  const totalFunded = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, monthlyFundingCap - totalFunded);

  useEffect(() => {
    if (!open) return;
    setError("");
    const tf = fundings
      .filter((f) => f.bucketId === bucketId)
      .reduce((s, l) => s + l.amount, 0);
    const rem = Math.max(0, monthlyFundingCap - tf);
    setAmountStr(monthlyFundingCap > 0 ? rem.toFixed(2) : "");
  }, [open, bucketId, monthlyFundingCap, fundings]);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amt > remaining + 0.005) {
      setError(`At most ${formatCurrency(remaining)} left to fund for this bucket`);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createFunding({
        userId,
        bucketId,
        amount: amt,
        monthKey,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bucket-fund-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bucket-fund-modal-title" className="font-semibold text-slate-800 mb-1">
          Fund bucket for the month
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          <span className="font-medium text-slate-700">{bucketName}</span> · {formatMonth(monthKey)} · Fill cap{" "}
          {formatCurrency(monthlyFundingCap)}
          {Math.abs(monthlyFundingCap - spendTarget) > 0.009 ? (
            <span> · Spend target {formatCurrency(spendTarget)}</span>
          ) : null}
        </p>
        <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
          <strong className="text-slate-700">Funded</strong> is cash you have planned in your{" "}
          <strong className="text-slate-700">overall budget</strong> for this envelope this month. It is separate from{" "}
          <strong className="text-slate-700">spent</strong> (actual category activity). Bank balances still follow
          transactions only.
        </p>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 mb-4">
          <p className="text-xs text-indigo-950 font-medium">
            {formatCurrency(totalFunded)} funded{" "}
            <span className="font-normal text-indigo-900/90">
              of {formatCurrency(monthlyFundingCap)} fill cap for {formatMonth(monthKey)}
            </span>
          </p>
          {remaining > 0.005 && (
            <p className="text-[11px] text-indigo-900/80 mt-1">
              Up to {formatCurrency(remaining)} more can be funded.
            </p>
          )}
        </div>

        {lines.length > 0 && (
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              disabled={clearAllLoading}
              onClick={async () => {
                setClearAllLoading(true);
                setError("");
                try {
                  await removeAllForMonth({ userId, bucketId, monthKey });
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not clear funding");
                } finally {
                  setClearAllLoading(false);
                }
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              {clearAllLoading ? "Clearing…" : "Remove all funding for this bucket"}
            </button>
          </div>
        )}

        {lines.length > 0 && (
          <ul className="space-y-2 mb-4">
            {lines.map((line) => {
              const acc = line.accountId ? accounts?.find((a) => a._id === line.accountId) : undefined;
              const label = acc ? `${acc.name} · ${formatCurrency(line.amount)}` : `Funding · ${formatCurrency(line.amount)}`;
              return (
                <li
                  key={line._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0" title={acc ? formatAccountType(acc.accountType) : undefined}>
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await removeFunding({ id: line._id, userId });
                      } catch {
                        // dev
                      }
                    }}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 shrink-0"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label htmlFor="bucket-fund-amt" className="block text-xs font-medium text-slate-600 mb-1">
              Amount ($)
            </label>
            <input
              id="bucket-fund-amt"
              type="number"
              step="0.01"
              min="0.01"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="0.00"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || remaining <= 0.005}
              className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Add funding"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2 text-sm font-medium"
            >
              Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
