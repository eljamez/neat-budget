"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CreditCardManager } from "@/components/CreditCardManager";
import { CreditCardMonthlyPaidGlance } from "@/components/CreditCardMonthlyPaidGlance";
import {
  formatCurrency,
  formatAprPercent,
  formatOrdinalDay,
  dateInBudgetMonth,
  getCurrentMonth,
  getProgressColor,
} from "@/lib/utils";
import { CreditCard } from "lucide-react";

export default function CreditCardsPage() {
  const { user } = useUser();
  const cards = useQuery(api.creditCards.list, user ? { userId: user.id } : "skip");
  const archiveCard = useMutation(api.creditCards.archive);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"creditCards"> | null>(null);
  const [archiveId, setArchiveId] = useState<Id<"creditCards"> | null>(null);

  const budgetMonth = getCurrentMonth();
  const sortedCards = useMemo(() => {
    if (!cards) return [];
    return [...cards].sort((a, b) => {
      const da = a.dueDayOfMonth;
      const db = b.dueDayOfMonth;
      if (da != null && db != null && da >= 1 && da <= 31 && db >= 1 && db <= 31) {
        const ta = dateInBudgetMonth(budgetMonth, da).getTime();
        const tb = dateInBudgetMonth(budgetMonth, db).getTime();
        if (ta !== tb) return ta - tb;
      } else if (da != null && da >= 1 && da <= 31 && (db == null || db < 1 || db > 31)) {
        return -1;
      } else if ((da == null || da < 1 || da > 31) && db != null && db >= 1 && db <= 31) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [cards, budgetMonth]);

  const editCard = cards?.find((c) => c._id === editId) ?? null;

  if (!user) return null;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit cards</h1>
          <p className="text-slate-500 text-sm mt-1">
            Balances, utilization, and when you last paid—sorted by due date.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setShowForm(true);
            }}
            className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 shrink-0"
          >
            + Add card
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">{editId ? "Edit card" : "New card"}</h2>
          <CreditCardManager
            key={editId ?? "new"}
            editCard={editId ? editCard : null}
            onSuccess={() => {
              setShowForm(false);
              setEditId(null);
            }}
            onCancel={() => {
              setShowForm(false);
              setEditId(null);
            }}
          />
        </div>
      )}

      {cards === undefined ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium mb-1">No credit cards yet</p>
          <p className="text-slate-400 text-sm mb-5">
            Add cards to track balance, limit, and payments.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700"
          >
            Add your first card
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedCards.map((c) => {
            const color = c.color ?? "#4f46e5";
            const apr = formatAprPercent(c.aprPercent);
            const limit = c.creditLimit != null && c.creditLimit > 0 ? c.creditLimit : null;
            const utilizationPct =
              limit != null && c.balance >= 0
                ? Math.min(100, Math.round((c.balance / limit) * 1000) / 10)
                : null;
            const barClass = utilizationPct != null ? getProgressColor(utilizationPct) : "bg-slate-300";
            const barWidth =
              utilizationPct != null ? `${Math.min(100, utilizationPct)}%` : limit != null ? "0%" : "0%";
            const dueLabel =
              c.dueDayOfMonth != null && c.dueDayOfMonth >= 1 && c.dueDayOfMonth <= 31
                ? `Due ${formatOrdinalDay(c.dueDayOfMonth)}`
                : "No due day";

            return (
              <li key={c._id}>
                <div
                  className="rounded-xl border border-slate-100 bg-white pl-3 pr-3 py-2.5 sm:py-2 shadow-sm"
                  style={{ borderLeftWidth: 3, borderLeftColor: color }}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <CreditCard className="w-4 h-4" style={{ color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                          <p className="text-xs text-slate-500 shrink-0">{dueLabel}</p>
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
                            {formatCurrency(c.balance)}
                          </span>
                          <span className="text-xs text-slate-500">owed</span>
                          {limit != null && (
                            <>
                              <span className="text-slate-300 text-sm mx-0.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-lg sm:text-xl font-semibold text-slate-800 tabular-nums">
                                {formatCurrency(limit)}
                              </span>
                              <span className="text-xs text-slate-500">limit</span>
                            </>
                          )}
                          {apr && (
                            <>
                              <span className="text-slate-300 text-sm mx-0.5" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs text-slate-500">{apr}</span>
                            </>
                          )}
                        </div>
                        {limit != null && utilizationPct != null && (
                          <div className="space-y-0.5">
                            <div
                              className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
                              role="img"
                              aria-label={`${utilizationPct}% of credit limit used`}
                            >
                              <div
                                className={`h-full rounded-full transition-[width] ${barClass}`}
                                style={{ width: barWidth }}
                              />
                            </div>
                            <p className={`text-[11px] font-medium tabular-nums ${utilizationPct >= 100 ? "text-red-600" : utilizationPct >= 80 ? "text-amber-700" : "text-slate-500"}`}>
                              {utilizationPct}% used
                            </p>
                          </div>
                        )}
                        {limit == null && (
                          <p className="text-[11px] text-slate-400">Add a limit in Edit to see utilization.</p>
                        )}
                        <p className="text-[11px] leading-snug">
                          <span className="text-slate-400 font-medium">Paid:</span>{" "}
                          <CreditCardMonthlyPaidGlance creditCardId={c._id} />
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 sm:flex-col sm:items-stretch sm:justify-center sm:min-w-18">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(c._id);
                          setShowForm(true);
                        }}
                        className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 px-2.5 py-1.5 rounded-lg hover:bg-teal-50 font-medium border border-transparent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveId(archiveId === c._id ? null : c._id)}
                        className="text-xs sm:text-sm text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-slate-100 sm:border-transparent"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                {archiveId === c._id && (
                  <div className="mt-1.5 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <p className="text-sm text-rose-700">
                      Remove <strong>{c.name}</strong>? Balances are unchanged.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-sm font-semibold text-white bg-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-700"
                        onClick={async () => {
                          await archiveCard({ id: c._id, userId: user.id });
                          setArchiveId(null);
                        }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="text-sm text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                        onClick={() => setArchiveId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
