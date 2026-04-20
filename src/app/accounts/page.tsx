"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { AccountManager } from "@/components/AccountManager";
import { formatCurrency, formatAccountType, ACCENT_COLOR_FALLBACK } from "@/lib/utils";
import { Landmark, Wallet } from "lucide-react";

export default function AccountsPage() {
  const { user } = useUser();
  const accounts = useQuery(api.accounts.list, user ? { userId: user.id } : "skip");
  const archiveAccount = useMutation(api.accounts.archive);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"accounts"> | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"accounts"> | null>(null);

  const editAccount = accounts?.find((a) => a._id === editId) ?? null;

  const handleArchiveConfirm = async () => {
    if (!archivePendingId || !user) return;
    await archiveAccount({ id: archivePendingId, userId: user.id });
    setArchivePendingId(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditId(null);
  };

  return (
    <div className="w-full space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100">Accounts</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Track cash in each bank account or card. When you add a transaction and choose an account,
            the balance updates automatically. Edit the balance here if it drifts from your bank.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setEditId(null);
              setShowForm(true);
            }}
            className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm shrink-0"
          >
            + Add account
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
          <h2 className="font-heading font-semibold text-slate-800 dark:text-slate-100 mb-5">
            {editId ? "Edit account" : "New account"}
          </h2>
          <AccountManager
            key={editId ?? "new"}
            editAccount={editId ? editAccount : null}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditId(null);
            }}
          />
        </div>
      )}

      {accounts === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-white/10 h-24 animate-pulse"
            />
          ))}
        </div>
      ) : accounts.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 p-12 text-center">
          <Wallet className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 dark:text-slate-400 mb-1 font-medium">No accounts yet</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">
            Add checking, savings, or a card so balances stay in sync when you log spending.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Add your first account
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {accounts.map((acc) => (
            <li key={acc._id}>
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm px-4 py-4 flex items-center justify-between gap-3"
                style={{
                  borderLeft: `3px solid ${
                    acc.accountType === "credit_card"
                      ? "#6366f1"
                      : acc.accountType === "other"
                      ? "#94a3b8"
                      : ACCENT_COLOR_FALLBACK.category
                  }`,
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      acc.accountType === "credit_card"
                        ? "bg-indigo-500/10"
                        : acc.accountType === "other"
                        ? "bg-slate-500/10"
                        : "bg-teal-500/10"
                    }`}
                    aria-hidden="true"
                  >
                    <Landmark className={`w-5 h-5 ${
                      acc.accountType === "credit_card"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : acc.accountType === "other"
                        ? "text-slate-500 dark:text-slate-400"
                        : "text-teal-600 dark:text-teal-400"
                    }`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{acc.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatAccountType(acc.accountType)}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-1 tabular-nums">
                      {formatCurrency(acc.balance)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(acc._id);
                      setShowForm(true);
                    }}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 px-3 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/50 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setArchivePendingId(archivePendingId === acc._id ? null : acc._id)
                    }
                    className="text-sm text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Archive
                  </button>
                </div>
              </div>
              {archivePendingId === acc._id && (
                <div
                  role="region"
                  aria-label={`Confirm archive ${acc.name}`}
                  className="mt-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm text-rose-700 dark:text-rose-300">
                    Archive <strong>{acc.name}</strong>? It will be hidden from active planning. Past
                    transactions keep their history.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleArchiveConfirm}
                      className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchivePendingId(null)}
                      className="text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
