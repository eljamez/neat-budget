"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatCurrency, formatMonth, formatAccountType } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  monthKey: string;
};

export function MonthFundingModal({ open, onClose, userId, monthKey }: Props) {
  const allocations = useQuery(
    api.expenseAllocations.listByUserMonth,
    open ? { userId, monthKey } : "skip"
  );
  const fundings = useQuery(
    api.bucketMonthFundings.listByUserMonth,
    open ? { userId, monthKey } : "skip"
  );
  const budgetItems = useQuery(api.budgetItems.listByUser, open ? { userId } : "skip");
  const buckets = useQuery(api.buckets.getBuckets, open ? { userId } : "skip");
  const accounts = useQuery(api.accounts.list, open ? { userId } : "skip");

  const removeAlloc = useMutation(api.expenseAllocations.remove);
  const removeFunding = useMutation(api.bucketMonthFundings.remove);
  const removeAllBill = useMutation(api.expenseAllocations.removeAllForBudgetMonth);
  const removeAllBucket = useMutation(api.bucketMonthFundings.removeAllForBucketMonth);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const itemNameById = useMemo(() => {
    if (!budgetItems) return {};
    return Object.fromEntries(budgetItems.map((b) => [b._id as string, b.name]));
  }, [budgetItems]);

  const bucketNameById = useMemo(() => {
    if (!buckets) return {};
    return Object.fromEntries(buckets.map((b) => [b._id as string, b.name]));
  }, [buckets]);

  const billGroups = useMemo(() => {
    if (!allocations) return [];
    const m = new Map<string, typeof allocations>();
    for (const a of allocations) {
      const k = a.budgetItemId as string;
      const list = m.get(k) ?? [];
      list.push(a);
      m.set(k, list);
    }
    return [...m.entries()].map(([budgetItemId, rows]) => ({
      budgetItemId: budgetItemId as Id<"budgetItems">,
      name: itemNameById[budgetItemId] ?? "Removed bill",
      total: rows.reduce((s, r) => s + r.amount, 0),
      rows,
    }));
  }, [allocations, itemNameById]);

  const bucketGroups = useMemo(() => {
    if (!fundings) return [];
    const m = new Map<string, typeof fundings>();
    for (const f of fundings) {
      const k = f.bucketId as string;
      const list = m.get(k) ?? [];
      list.push(f);
      m.set(k, list);
    }
    return [...m.entries()].map(([bucketId, rows]) => ({
      bucketId: bucketId as Id<"buckets">,
      name: bucketNameById[bucketId] ?? "Bucket",
      total: rows.reduce((s, r) => s + r.amount, 0),
      rows,
    }));
  }, [fundings, bucketNameById]);

  if (!open) return null;

  const loading =
    allocations === undefined ||
    fundings === undefined ||
    budgetItems === undefined ||
    buckets === undefined;

  const totalBills = billGroups.reduce((s, g) => s + g.total, 0);
  const totalBuckets = bucketGroups.reduce((s, g) => s + g.total, 0);
  const grandTotal = totalBills + totalBuckets;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-funding-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg max-h-[min(90vh,40rem)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100">
          <h2 id="month-funding-title" className="font-semibold text-slate-900 text-lg">
            Funding for {formatMonth(monthKey)}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Remove lines here or on the timeline. To add funding: tap{" "}
            <strong className="text-slate-600">Waiting</strong> on a bill row or{" "}
            <strong className="text-slate-600">Fund bucket</strong> in the sidebar.
          </p>
          {!loading && (
            <p className="text-sm font-semibold text-slate-800 mt-2 tabular-nums">
              Total funded: {formatCurrency(grandTotal)}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 pt-4 space-y-6">
          {error ? (
            <p role="alert" className="text-xs text-rose-600 bg-rose-50 px-2 py-1.5 rounded-lg">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-12 bg-slate-100 rounded-xl" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Bills
                </h3>
                {billGroups.length === 0 ? (
                  <p className="text-sm text-slate-500">No bill funding this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {billGroups.map((g) => (
                      <li
                        key={g.budgetItemId}
                        className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{g.name}</p>
                            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                              {formatCurrency(g.total)} this month
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={pendingId === `bill:${g.budgetItemId}`}
                            onClick={async () => {
                              setError("");
                              setPendingId(`bill:${g.budgetItemId}`);
                              try {
                                await removeAllBill({
                                  userId,
                                  budgetItemId: g.budgetItemId,
                                  monthKey,
                                });
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Could not remove");
                              } finally {
                                setPendingId(null);
                              }
                            }}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 shrink-0 disabled:opacity-50"
                          >
                            Clear all
                          </button>
                        </div>
                        {g.rows.length > 1 ? (
                          <ul className="mt-2 space-y-1 border-t border-slate-200/80 pt-2">
                            {g.rows.map((row) => {
                              const acc = row.accountId
                                ? accounts?.find((a) => a._id === row.accountId)
                                : undefined;
                              return (
                                <li
                                  key={row._id}
                                  className="flex items-center justify-between gap-2 text-xs text-slate-600"
                                >
                                  <span className="truncate">
                                    {acc ? `${acc.name} · ` : ""}
                                    {formatCurrency(row.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={pendingId === row._id}
                                    onClick={async () => {
                                      setError("");
                                      setPendingId(row._id);
                                      try {
                                        await removeAlloc({ id: row._id, userId });
                                      } catch (e) {
                                        setError(e instanceof Error ? e.message : "Could not remove");
                                      } finally {
                                        setPendingId(null);
                                      }
                                    }}
                                    className="font-medium text-rose-600 hover:text-rose-700 shrink-0"
                                  >
                                    Remove
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Buckets
                </h3>
                {bucketGroups.length === 0 ? (
                  <p className="text-sm text-slate-500">No bucket funding this month.</p>
                ) : (
                  <ul className="space-y-3">
                    {bucketGroups.map((g) => (
                      <li
                        key={g.bucketId}
                        className="rounded-xl border border-slate-100 bg-indigo-50/40 px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 text-sm truncate">{g.name}</p>
                            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                              {formatCurrency(g.total)} funded
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={pendingId === `bucket:${g.bucketId}`}
                            onClick={async () => {
                              setError("");
                              setPendingId(`bucket:${g.bucketId}`);
                              try {
                                await removeAllBucket({
                                  userId,
                                  bucketId: g.bucketId,
                                  monthKey,
                                });
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Could not remove");
                              } finally {
                                setPendingId(null);
                              }
                            }}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-700 shrink-0 disabled:opacity-50"
                          >
                            Clear all
                          </button>
                        </div>
                        {g.rows.length > 1 ? (
                          <ul className="mt-2 space-y-1 border-t border-indigo-100 pt-2">
                            {g.rows.map((row) => {
                              const acc = row.accountId
                                ? accounts?.find((a) => a._id === row.accountId)
                                : undefined;
                              return (
                                <li
                                  key={row._id}
                                  className="flex items-center justify-between gap-2 text-xs text-slate-600"
                                >
                                  <span className="truncate">
                                    {acc
                                      ? `${acc.name} (${formatAccountType(acc.accountType)}) · `
                                      : ""}
                                    {formatCurrency(row.amount)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={pendingId === row._id}
                                    onClick={async () => {
                                      setError("");
                                      setPendingId(row._id);
                                      try {
                                        await removeFunding({ id: row._id, userId });
                                      } catch (e) {
                                        setError(e instanceof Error ? e.message : "Could not remove");
                                      } finally {
                                        setPendingId(null);
                                      }
                                    }}
                                    className="font-medium text-rose-600 hover:text-rose-700 shrink-0"
                                  >
                                    Remove
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {!loading && billGroups.length === 0 && bucketGroups.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Use the timeline — tap <strong className="text-slate-800">Waiting</strong> or{" "}
                  <strong className="text-slate-800">Partly funded</strong> on a bill — or{" "}
                  <strong className="text-slate-800">Fund bucket</strong> in the sidebar for envelopes.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-100 text-slate-800 py-2.5 text-sm font-medium hover:bg-slate-200/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
