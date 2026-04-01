"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DebtManager } from "@/components/DebtManager";
import { DebtPaymentLog } from "@/components/DebtPaymentLog";
import {
  formatCurrency,
  formatDebtType,
  formatAprPercent,
  formatOrdinalDay,
  estimateDebtPayoff,
} from "@/lib/utils";
import {
  Landmark,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function DebtsPage() {
  const { user } = useUser();
  const debts = useQuery(api.debts.list, user ? { userId: user.id } : "skip");
  const archiveDebt = useMutation(api.debts.archive);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"debts"> | null>(null);
  const [archiveDebtId, setArchiveDebtId] = useState<Id<"debts"> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!debts || debts.length === 0) {
      listSigRef.current = null;
      setExpanded(new Set());
      return;
    }
    const sig = debts
      .map((d) => d._id)
      .sort()
      .join("|");
    const prev = listSigRef.current;
    listSigRef.current = sig;
    const prevIds = prev ? new Set(prev.split("|")) : null;
    setExpanded((prevS) => {
      const next = new Set(prevS);
      if (!prevIds) {
        return new Set(debts.map((d) => d._id));
      }
      for (const d of debts) {
        if (!prevIds.has(d._id)) next.add(d._id);
      }
      for (const id of next) {
        if (!debts.some((d) => d._id === id)) next.delete(id);
      }
      return next;
    });
  }, [debts]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const editDebt = debts?.find((d) => d._id === editId) ?? null;

  if (!user) return null;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Debts</h1>
          <p className="text-slate-400 text-sm mt-1">
            Loans and non–credit-card balances. Credit cards have their own page. Set planned paydown and
            due day to show each item on the Categories timeline. Log a transaction linked here to record a
            payment—or edit the balance to match your lender.
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
            + Add debt
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">
            {editId ? "Edit debt" : "New debt"}
          </h2>
          <DebtManager
            key={editId ?? "new"}
            editDebt={editId ? editDebt : null}
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

      {debts === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : debts.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium mb-1">No debts tracked yet</p>
          <p className="text-slate-400 text-sm mb-5">
            Add loans here; use Credit cards for revolving accounts. Planned payments appear under Categories.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700"
          >
            Add your first debt
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {debts.map((d) => {
            const isOpen = expanded.has(d._id);
            const color = d.color ?? "#64748b";
            const apr = formatAprPercent(d.aprPercent);
            const payoff =
              d.plannedMonthlyPayment != null && d.plannedMonthlyPayment > 0
                ? estimateDebtPayoff(d.balance, d.plannedMonthlyPayment, d.aprPercent)
                : null;

            return (
              <div key={d._id}>
                <div
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(d._id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      aria-expanded={isOpen}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <Landmark className="w-5 h-5" style={{ color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate flex flex-wrap items-center gap-2">
                          <span>{d.name}</span>
                          {d.isAutopay ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                              Auto-pay
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDebtType(d.debtType)}
                          {d.creditor && ` · ${d.creditor}`}
                          {d.dueDayOfMonth != null && ` · Due ${formatOrdinalDay(d.dueDayOfMonth)}`}
                        </p>
                        <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                          {formatCurrency(d.balance)} owed
                        </p>
                        {(apr || d.minimumPayment != null) && (
                          <p className="text-xs text-slate-400 mt-1">
                            {apr && <span>{apr}</span>}
                            {apr && d.minimumPayment != null && <span> · </span>}
                            {d.minimumPayment != null && (
                              <span>Min {formatCurrency(d.minimumPayment)}/mo</span>
                            )}
                          </p>
                        )}
                        {d.plannedMonthlyPayment != null && d.plannedMonthlyPayment > 0 && (
                          <p className="text-xs text-teal-700 font-medium mt-1">
                            Plan {formatCurrency(d.plannedMonthlyPayment)}/mo
                            {d.dueDayOfMonth != null &&
                              ` · day ${d.dueDayOfMonth} on Categories timeline & Debts section`}
                          </p>
                        )}
                        {payoff?.payoffMonthLabel && (
                          <p className="text-xs text-slate-500 mt-1">
                            Est. payoff {payoff.payoffMonthLabel}
                            {payoff.monthsRemaining != null && payoff.monthsRemaining > 1
                              ? ` (~${payoff.monthsRemaining} mo at this payment)`
                              : ""}
                          </p>
                        )}
                        {payoff?.note && (
                          <p className="text-xs text-amber-700 mt-1">{payoff.note}</p>
                        )}
                        {d.purpose && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{d.purpose}</p>
                        )}
                        {d.notes && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.notes}</p>
                        )}
                      </div>
                      <div className="text-slate-400 shrink-0">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(d._id);
                          setShowForm(true);
                        }}
                        className="text-sm text-teal-600 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setArchiveDebtId(archiveDebtId === d._id ? null : d._id)
                        }
                        className="text-sm text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-4">
                      {(d.plannedMonthlyPayment == null ||
                        d.plannedMonthlyPayment <= 0 ||
                        d.dueDayOfMonth == null) && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          Add a <strong className="font-semibold">planned monthly paydown</strong> and{" "}
                          <strong className="font-semibold">typical due day</strong> above to show this debt on
                          your Categories timeline and in the Debts section at the bottom of that page.
                        </p>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Recorded payments</p>
                        <DebtPaymentLog debtId={d._id} />
                      </div>
                    </div>
                  )}
                </div>

                {archiveDebtId === d._id && (
                  <div className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex justify-between items-center gap-3">
                    <p className="text-sm text-rose-700">
                      Remove <strong>{d.name}</strong> from your list? Balances are unchanged.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-sm font-semibold text-white bg-rose-600 px-3 py-1.5 rounded-lg"
                        onClick={async () => {
                          await archiveDebt({ id: d._id, userId: user.id });
                          setArchiveDebtId(null);
                        }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="text-sm text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                        onClick={() => setArchiveDebtId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
