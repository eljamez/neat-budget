"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Pencil, Trash2, Check, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteModalProps {
  budgetName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ budgetName, isDeleting, onConfirm, onCancel }: DeleteModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full sm:w-3/4 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Red accent bar */}
        <div className="h-1 bg-red-500" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <TriangleAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2
                id="delete-modal-title"
                className="font-heading text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Delete &ldquo;{budgetName}&rdquo;?
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                This will <strong className="font-semibold text-slate-800 dark:text-slate-200">permanently delete</strong> the budget along with every account, transaction, category, and piece of data inside it.
              </p>
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                There is no undo. This cannot be recovered.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full sm:w-auto rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Keep budget
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full sm:w-auto rounded-lg bg-red-600 hover:bg-red-500 active:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              {isDeleting ? "Deleting…" : "Yes, permanently delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const budgets = useQuery(api.budgets.list, user ? { userId: user.id } : "skip");
  const renameBudget = useMutation(api.budgets.rename);
  const removeBudget = useMutation(api.budgets.remove);

  const [editingId, setEditingId] = useState<Id<"budgets"> | null>(null);
  const [editName, setEditName] = useState("");
  const [deletePendingId, setDeletePendingId] = useState<Id<"budgets"> | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (id: Id<"budgets">, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async () => {
    if (!editingId || !user || !editName.trim()) return;
    setIsSaving(true);
    try {
      await renameBudget({ userId: user.id, budgetId: editingId, name: editName.trim() });
      setEditingId(null);
      setEditName("");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletePendingId || !user) return;
    setIsDeleting(true);
    try {
      await removeBudget({ userId: user.id, budgetId: deletePendingId });
      setDeletePendingId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = (budgets?.length ?? 0) > 1;
  const deletePendingBudget = budgets?.find((b) => b._id === deletePendingId) ?? null;

  return (
    <>
      <div className="w-full max-w-2xl space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-100">
            Settings
          </h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            Manage your budgets and preferences.
          </p>
        </div>

        <section>
          <h2 className="font-heading text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Budgets
          </h2>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {(budgets ?? []).map((budget) => {
              const isEditing = editingId === budget._id;

              return (
                <div
                  key={budget._id}
                  className="flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-slate-900"
                >
                  {isEditing ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveEdit();
                      }}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={80}
                        className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
                      />
                      <button
                        type="submit"
                        disabled={isSaving || !editName.trim()}
                        className="flex items-center justify-center w-8 h-8 rounded-md bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors"
                        aria-label="Save name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {budget.name}
                          </span>
                          {budget.isActive && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                              Active
                            </span>
                          )}
                          {budget.isDefault && (
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(budget._id, budget.name)}
                          className="flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          aria-label={`Rename ${budget.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletePendingId(budget._id)}
                          disabled={!canDelete}
                          className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                            canDelete
                              ? "text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              : "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                          )}
                          aria-label={
                            canDelete ? `Delete ${budget.name}` : "Cannot delete the only budget"
                          }
                          title={!canDelete ? "You must have at least one budget" : undefined}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {budgets === undefined && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Loading…</div>
            )}
          </div>
        </section>
      </div>

      {deletePendingBudget && (
        <DeleteModal
          budgetName={deletePendingBudget.name}
          isDeleting={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeletePendingId(null)}
        />
      )}
    </>
  );
}
