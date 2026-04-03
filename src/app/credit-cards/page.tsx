"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CreditCardManager } from "@/components/CreditCardManager";
import { CreditCardPaymentLog } from "@/components/CreditCardPaymentLog";
import {
  formatCurrency,
  formatAprPercent,
  formatOrdinalDay,
  estimateDebtPayoff,
  formatCreditCardUsageMode,
  CREDIT_CARD_USAGE_LABELS,
  formatAccountType,
} from "@/lib/utils";
import { ChevronDown, ChevronRight, CreditCard } from "lucide-react";

export default function CreditCardsPage() {
  const { user } = useUser();
  const cards = useQuery(api.creditCards.list, user ? { userId: user.id } : "skip");
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const archiveCard = useMutation(api.creditCards.archive);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"creditCards"> | null>(null);
  const [archiveId, setArchiveId] = useState<Id<"creditCards"> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const listSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cards || cards.length === 0) {
      listSigRef.current = null;
      setExpanded(new Set());
      return;
    }
    const sig = cards
      .map((c) => c._id)
      .sort()
      .join("|");
    const prev = listSigRef.current;
    listSigRef.current = sig;
    const prevIds = prev ? new Set(prev.split("|")) : null;
    setExpanded((prevS) => {
      const next = new Set(prevS);
      if (!prevIds) {
        return new Set(cards.map((c) => c._id));
      }
      for (const c of cards) {
        if (!prevIds.has(c._id)) next.add(c._id);
      }
      for (const id of next) {
        if (!cards.some((c) => c._id === id)) next.delete(id);
      }
      return next;
    });
  }, [cards]);

  const toggle = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const editCard = cards?.find((c) => c._id === editId) ?? null;

  if (!user) return null;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit cards</h1>
          <p className="text-slate-400 text-sm mt-1">
            Track each card separately from installment debts. Mark whether you&apos;re{" "}
            <strong className="font-semibold text-slate-600">using it for bills</strong> or{" "}
            <strong className="font-semibold text-slate-600">paying it off</strong> so your budget stays
            clear. Set a planned payment and due day to show the card on your Categories timeline.
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
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border animate-pulse" />
          ))}
        </div>
      ) : cards.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium mb-1">No credit cards yet</p>
          <p className="text-slate-400 text-sm mb-5">
            Add the cards you charge to and pay off. They appear next to debts on Categories and the
            timeline.
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
        <div className="space-y-2.5">
          {cards.map((c) => {
            const isOpen = expanded.has(c._id);
            const color = c.color ?? "#4f46e5";
            const apr = formatAprPercent(c.aprPercent);
            const payoff =
              c.plannedMonthlyPayment != null && c.plannedMonthlyPayment > 0
                ? estimateDebtPayoff(c.balance, c.plannedMonthlyPayment, c.aprPercent)
                : null;
            const utilizationPct =
              c.creditLimit != null && c.creditLimit > 0 && c.balance >= 0
                ? Math.min(100, Math.round((c.balance / c.creditLimit) * 1000) / 10)
                : null;
            const usageShort =
              c.usageMode === "paying_off"
                ? CREDIT_CARD_USAGE_LABELS.paying_off
                : CREDIT_CARD_USAGE_LABELS.active_use;
            const payFromAccount =
              c.paymentAccountId && accounts
                ? accounts.find((a) => a._id === c.paymentAccountId)
                : undefined;

            return (
              <div key={c._id}>
                <div
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(c._id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      aria-expanded={isOpen}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}18` }}
                      >
                        <CreditCard className="w-5 h-5" style={{ color }} aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate flex flex-wrap items-center gap-2">
                          <span>{c.name}</span>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                              c.usageMode === "paying_off"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {usageShort}
                          </span>
                          {c.isAutopay ? (
                            <span className="text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                              Auto-pay
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatCreditCardUsageMode(c.usageMode)}
                          {c.creditor && ` · ${c.creditor}`}
                          {c.dueDayOfMonth != null && ` · Due ${formatOrdinalDay(c.dueDayOfMonth)}`}
                        </p>
                        <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                          {formatCurrency(c.balance)} owed
                        </p>
                        {c.creditLimit != null && c.creditLimit > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            Limit {formatCurrency(c.creditLimit)}
                            {utilizationPct != null && (
                              <span className="text-slate-400"> · {utilizationPct}% used</span>
                            )}
                          </p>
                        )}
                        {(apr || c.minimumPayment != null) && (
                          <p className="text-xs text-slate-400 mt-1">
                            {apr && <span>{apr}</span>}
                            {apr && c.minimumPayment != null && <span> · </span>}
                            {c.minimumPayment != null && (
                              <span>Min {formatCurrency(c.minimumPayment)}/mo</span>
                            )}
                          </p>
                        )}
                        {c.plannedMonthlyPayment != null && c.plannedMonthlyPayment > 0 && (
                          <p className="text-xs text-teal-700 font-medium mt-1">
                            Plan {formatCurrency(c.plannedMonthlyPayment)}/mo
                            {c.dueDayOfMonth != null &&
                              ` · day ${c.dueDayOfMonth} on timeline & Categories`}
                          </p>
                        )}
                        {payFromAccount && (
                          <p className="text-xs text-slate-600 mt-1">
                            Pay bill from{" "}
                            <span className="font-medium text-slate-800">
                              {payFromAccount.name}
                            </span>{" "}
                            ({formatAccountType(payFromAccount.accountType)})
                          </p>
                        )}
                        {payoff?.payoffMonthLabel && c.usageMode === "paying_off" && (
                          <p className="text-xs text-slate-500 mt-1">
                            Est. payoff {payoff.payoffMonthLabel}
                            {payoff.monthsRemaining != null && payoff.monthsRemaining > 1
                              ? ` (~${payoff.monthsRemaining} mo at this payment)`
                              : ""}
                          </p>
                        )}
                        {payoff?.note && c.usageMode === "paying_off" && (
                          <p className="text-xs text-amber-700 mt-1">{payoff.note}</p>
                        )}
                        {c.purpose && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{c.purpose}</p>
                        )}
                        {c.notes && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.notes}</p>
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
                          setEditId(c._id);
                          setShowForm(true);
                        }}
                        className="text-sm text-teal-600 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchiveId(archiveId === c._id ? null : c._id)}
                        className="text-sm text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-4">
                      {(c.plannedMonthlyPayment == null ||
                        c.plannedMonthlyPayment <= 0 ||
                        c.dueDayOfMonth == null) && (
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          Add a <strong className="font-semibold">planned monthly payment</strong> and{" "}
                          <strong className="font-semibold">typical due day</strong> to show this card on the
                          Categories timeline.
                        </p>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Recorded payments</p>
                        <CreditCardPaymentLog creditCardId={c._id} />
                      </div>
                    </div>
                  )}
                </div>

                {archiveId === c._id && (
                  <div className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex justify-between items-center gap-3">
                    <p className="text-sm text-rose-700">
                      Remove <strong>{c.name}</strong>? Balances are unchanged.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        className="text-sm font-semibold text-white bg-rose-600 px-3 py-1.5 rounded-lg"
                        onClick={async () => {
                          await archiveCard({ id: c._id, userId: user.id });
                          setArchiveId(null);
                        }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="text-sm text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg"
                        onClick={() => setArchiveId(null)}
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
