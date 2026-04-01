"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ACCOUNT_TYPE_LABELS, type AccountTypeKey } from "@/lib/utils";

interface Account {
  _id: Id<"accounts">;
  name: string;
  balance: number;
  accountType: string;
}

interface AccountManagerProps {
  editAccount?: Account | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AccountManager({ editAccount, onSuccess, onCancel }: AccountManagerProps) {
  const { user } = useUser();
  const createAccount = useMutation(api.accounts.create);
  const updateAccount = useMutation(api.accounts.update);

  const [form, setForm] = useState({
    name: editAccount?.name ?? "",
    balance: editAccount != null ? String(editAccount.balance) : "0",
    accountType: (editAccount?.accountType && editAccount.accountType in ACCOUNT_TYPE_LABELS
      ? editAccount.accountType
      : "checking") as AccountTypeKey,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const bal = parseFloat(form.balance);
    if (isNaN(bal)) {
      setError("Please enter a valid balance");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (editAccount) {
        await updateAccount({
          id: editAccount._id,
          userId: user.id,
          name: form.name,
          balance: bal,
          accountType: form.accountType,
        });
      } else {
        await createAccount({
          userId: user.id,
          name: form.name,
          balance: bal,
          accountType: form.accountType,
        });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="acc-name" className="block text-sm font-medium text-slate-600 mb-1.5">
          Account name
        </label>
        <input
          id="acc-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Chase Checking, Cash envelope"
          maxLength={120}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label htmlFor="acc-type" className="block text-sm font-medium text-slate-600 mb-1.5">
          Type
        </label>
        <select
          id="acc-type"
          value={form.accountType}
          onChange={(e) =>
            setForm({ ...form, accountType: e.target.value as AccountTypeKey })
          }
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
        >
          {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountTypeKey[]).map((key) => (
            <option key={key} value={key}>
              {ACCOUNT_TYPE_LABELS[key]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 mt-1.5">
          For credit cards, balance is amount owed. Spending logged from this account increases that
          balance; for checking and savings, spending decreases it.
        </p>
      </div>

      <div>
        <label htmlFor="acc-balance" className="block text-sm font-medium text-slate-600 mb-1.5">
          Current balance ($)
        </label>
        <input
          id="acc-balance"
          type="number"
          step="0.01"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          placeholder="0.00"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
        <p className="text-xs text-slate-400 mt-1.5">
          {editAccount
            ? "Update this when your bank app doesn’t match Neat Budget, or after transfers not logged here."
            : "Starting balance. It will change when you log spending from this account or adjust here."}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 transition-all"
        >
          {loading ? "Saving..." : editAccount ? "Update account" : "Add account"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
