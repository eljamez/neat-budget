"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatAccountType } from "@/lib/utils";

type FundingRow = {
  _id: Id<"bucketMonthFundings">;
  bucketId: Id<"buckets">;
  accountId: Id<"accounts">;
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
  /** Max cash earmarked for this bucket this month (monthly fill goal or spending target). */
  monthlyFundingCap: number;
  /** Spending allowance shown for context (target amount). */
  spendTarget: number;
  defaultAccountId?: Id<"accounts"> | null;
  fundings: FundingRow[];
  accounts: AccountOption[] | undefined;
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
  defaultAccountId,
  fundings,
  accounts,
}: BucketFundingModalProps) {
  const createFunding = useMutation(api.bucketMonthFundings.create);
  const removeFunding = useMutation(api.bucketMonthFundings.remove);

  const [accountId, setAccountId] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lines = fundings.filter((f) => f.bucketId === bucketId);
  const totalFunded = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, monthlyFundingCap - totalFunded);

  const accountsSorted = accounts
    ? [...accounts].sort((a, b) => a.name.localeCompare(b.name))
    : [];

  useEffect(() => {
    if (!open) return;
    setError("");
    setAccountId(defaultAccountId ? String(defaultAccountId) : "");
    const tf = fundings
      .filter((f) => f.bucketId === bucketId)
      .reduce((s, l) => s + l.amount, 0);
    const rem = Math.max(0, monthlyFundingCap - tf);
    setAmountStr(monthlyFundingCap > 0 ? rem.toFixed(2) : "");
  }, [open, bucketId, monthlyFundingCap, defaultAccountId, fundings]);

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (!accountId) {
      setError("Choose an account");
      return;
    }
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
        accountId: accountId as Id<"accounts">,
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
          <strong className="text-slate-700">Funded</strong> means you have planned cash in a real
          account for this envelope this month. It is separate from <strong className="text-slate-700">spent</strong>{" "}
          (actual category activity).
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
              Up to {formatCurrency(remaining)} more can be earmarked.
            </p>
          )}
        </div>

        {lines.length > 0 && (
          <ul className="space-y-2 mb-4">
            {lines.map((line) => {
              const acc = accounts?.find((a) => a._id === line.accountId);
              return (
                <li
                  key={line._id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
                >
                  <span className="text-sm text-slate-700 truncate min-w-0">
                    {acc?.name ?? "Account"} · {formatCurrency(line.amount)}
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
            <label htmlFor="bucket-fund-account" className="block text-xs font-medium text-slate-600 mb-1">
              From account
            </label>
            <select
              id="bucket-fund-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white"
            >
              <option value="">Select…</option>
              {accountsSorted.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name} ({formatAccountType(a.accountType)})
                </option>
              ))}
            </select>
          </div>
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
              disabled={loading || accountsSorted.length === 0 || remaining <= 0.005}
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
        {accountsSorted.length === 0 && (
          <p className="text-xs text-slate-500 mt-3">Add an account under Accounts before funding buckets.</p>
        )}
      </div>
    </div>
  );
}
