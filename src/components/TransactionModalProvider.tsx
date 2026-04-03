"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import { X } from "lucide-react";
import { TransactionForm } from "@/components/TransactionForm";
import type { Doc } from "../../convex/_generated/dataModel";

type TransactionModalContextValue = {
  openAddTransaction: () => void;
  closeAddTransaction: () => void;
  openEditTransaction: (tx: Doc<"transactions">) => void;
  closeEditTransaction: () => void;
};

const TransactionModalContext = createContext<TransactionModalContextValue | null>(null);

export function useTransactionModal() {
  const ctx = useContext(TransactionModalContext);
  if (!ctx) {
    throw new Error("useTransactionModal must be used within TransactionModalProvider");
  }
  return ctx;
}

function TransactionModal({
  open,
  onClose,
  editTransaction,
}: {
  open: boolean;
  onClose: () => void;
  editTransaction: Doc<"transactions"> | null;
}) {
  const titleId = useId();
  const isEdit = Boolean(editTransaction);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg max-h-[min(92vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-xl border border-slate-100 mt-auto sm:mt-0 overflow-hidden">
        <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {isEdit ? "Edit transaction" : "Add transaction"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
          <TransactionForm
            key={editTransaction?._id ?? "new"}
            onSuccess={onClose}
            editTransaction={editTransaction ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

export function TransactionModalProvider({ children }: { children: React.ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Doc<"transactions"> | null>(
    null
  );

  const closeAll = useCallback(() => {
    setAddOpen(false);
    setEditTransaction(null);
  }, []);

  const openAddTransaction = useCallback(() => {
    setEditTransaction(null);
    setAddOpen(true);
  }, []);
  const closeAddTransaction = useCallback(() => {
    setAddOpen(false);
  }, []);
  const openEditTransaction = useCallback((tx: Doc<"transactions">) => {
    setAddOpen(false);
    setEditTransaction(tx);
  }, []);
  const closeEditTransaction = useCallback(() => {
    setEditTransaction(null);
  }, []);

  const value: TransactionModalContextValue = {
    openAddTransaction,
    closeAddTransaction,
    openEditTransaction,
    closeEditTransaction,
  };

  const modalOpen = addOpen || editTransaction !== null;

  return (
    <TransactionModalContext.Provider value={value}>
      {children}
      <TransactionModal
        open={modalOpen}
        onClose={closeAll}
        editTransaction={editTransaction}
      />
    </TransactionModalContext.Provider>
  );
}
