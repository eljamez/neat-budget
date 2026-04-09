"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BucketManager } from "@/components/BucketManager";
import { formatCurrency, ACCENT_COLOR_FALLBACK } from "@/lib/utils";
import type { Bucket } from "@/types/bucket";
import { Boxes } from "lucide-react";

const PERIOD_LABEL: Record<Bucket["period"], string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export default function BucketsPage() {
  const { user } = useUser();
  const buckets = useQuery(api.buckets.getBuckets, user ? { userId: user.id } : "skip");
  const categories = useQuery(api.categories.list, user ? { userId: user.id } : "skip");
  const deleteBucket = useMutation(api.buckets.deleteBucket);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<Id<"buckets"> | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<Id<"buckets"> | null>(null);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories ?? []) m.set(c._id, c.name);
    return m;
  }, [categories]);

  const sortedBuckets = useMemo(() => {
    if (!buckets) return [];
    return [...buckets].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [buckets]);

  const editBucket = sortedBuckets.find((b) => b._id === editId) ?? null;

  const handleDeleteConfirm = async () => {
    if (!deletePendingId || !user) return;
    const id = deletePendingId;
    await deleteBucket({ id, userId: user.id });
    setDeletePendingId(null);
    if (editId === id) {
      setEditId(null);
      setShowForm(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditId(null);
  };

  return (
    <div className="w-full space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Buckets</h1>
          <p className="text-slate-400 text-sm mt-1">
            Discretionary envelopes (groceries, fun money, and so on). Targets and category links are
            always-on setup—monthly funding and spend in context live on the{" "}
            <Link href="/dashboard" className="text-teal-600 font-medium hover:text-teal-700">
              dashboard
            </Link>
            .
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
            + Add bucket
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">
            {editId ? "Edit bucket" : "New bucket"}
          </h2>
          <BucketManager
            key={editId ?? "new"}
            editBucket={editId ? editBucket : null}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditId(null);
            }}
          />
        </div>
      )}

      {buckets === undefined ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : sortedBuckets.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 mb-1 font-medium">No buckets yet</p>
          <p className="text-slate-500 text-sm mb-5 max-w-md mx-auto">
            Create a bucket for each discretionary area you want to cap. Targets are goals, not due
            bills like planned expenses under Categories.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Add your first bucket
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sortedBuckets.map((b) => (
            <li key={b._id}>
              <div
                className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-4 flex items-center justify-between gap-3"
                style={{ borderLeft: `3px solid ${ACCENT_COLOR_FALLBACK.category}` }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Boxes className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {PERIOD_LABEL[b.period]}
                      {b.rollover ? " · rolls over" : ""}
                      {b.categoryId ? ` · ${categoryNameById.get(b.categoryId) ?? "Category"}` : ""}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                      {formatCurrency(b.targetAmount)} <span className="text-sm font-medium text-slate-500">target</span>
                    </p>
                    {b.note ? (
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{b.note}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditId(b._id);
                      setShowForm(true);
                    }}
                    className="text-sm text-teal-600 hover:text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-50 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeletePendingId(deletePendingId === b._id ? null : b._id)
                    }
                    className="text-sm text-slate-500 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {deletePendingId === b._id && (
                <div
                  role="region"
                  aria-label={`Confirm delete ${b.name}`}
                  className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <p className="text-sm text-rose-700">
                    Permanently delete <strong>{b.name}</strong>? This cannot be undone.
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDeleteConfirm}
                      className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePendingId(null)}
                      className="text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
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
