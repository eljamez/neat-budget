"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CategoryManager } from "@/components/CategoryManager";
import { formatCurrency } from "@/lib/utils";
import { CATEGORY_ICON_MAP } from "@/lib/icons";
import { FolderOpen } from "lucide-react";

interface Category {
  _id: Id<"categories">;
  name: string;
  monthlyLimit: number;
  color?: string;
  icon?: string;
}

export default function CategoriesPage() {
  const { user } = useUser();
  const categories = useQuery(
    api.categories.list,
    user ? { userId: user.id } : "skip"
  );
  const archiveCategory = useMutation(api.categories.archive);

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [archivePendingId, setArchivePendingId] = useState<Id<"categories"> | null>(null);

  const handleEdit = (cat: Category) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!archivePendingId) return;
    await archiveCategory({ id: archivePendingId });
    setArchivePendingId(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditCategory(null);
  };

  return (
    <div className="max-w-2xl space-y-5 lg:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your monthly budget limits</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditCategory(null); }}
            className="bg-teal-600 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all shadow-sm"
          >
            + New Category
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">
            {editCategory ? "Edit Category" : "New Category"}
          </h2>
          <CategoryManager
            editCategory={editCategory}
            onSuccess={handleFormSuccess}
            onCancel={() => { setShowForm(false); setEditCategory(null); }}
          />
        </div>
      )}

      {/* Category List */}
      {categories === undefined ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-18 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" aria-hidden="true" />
          <p className="text-slate-500 mb-1 font-medium">No categories yet</p>
          <p className="text-slate-500 text-sm mb-5">Create budget categories to start tracking your spending</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-teal-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-teal-700 active:scale-[0.97] transition-all"
          >
            Create your first category
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {categories.map((cat) => (
            <div key={cat._id}>
              <div
                className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5 flex items-center justify-between group hover:border-slate-200 transition-colors"
                style={{ borderLeft: `3px solid ${cat.color ?? "#0d9488"}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cat.color ? `${cat.color}18` : "#0d948818" }}
                  >
                    {(() => {
                      const iconName = cat.icon;
                      const IconComp = iconName ? CATEGORY_ICON_MAP[iconName] : null;
                      const color = cat.color ?? "#0d9488";
                      return IconComp
                        ? <IconComp className="w-5 h-5" style={{ color }} />
                        : <span className="text-xl">{iconName ?? "💰"}</span>;
                    })()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{cat.name}</p>
                    <p className="text-sm text-slate-500">{formatCurrency(cat.monthlyLimit)} / month</p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { handleEdit(cat); }}
                    className="text-sm text-teal-600 hover:text-teal-700 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-teal-50 transition-colors font-medium min-h-[2.75rem] lg:min-h-0 flex items-center"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setArchivePendingId(archivePendingId === cat._id ? null : cat._id)}
                    aria-expanded={archivePendingId === cat._id}
                    className="text-sm text-slate-500 hover:text-rose-600 px-3 py-2 lg:py-1.5 rounded-lg hover:bg-rose-50 transition-colors min-h-[2.75rem] lg:min-h-0 flex items-center"
                  >
                    Archive
                  </button>
                </div>
              </div>

              {archivePendingId === cat._id && (
                <div
                  role="region"
                  aria-label={`Confirm archive for ${cat.name}`}
                  className="mt-1 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <p className="text-sm text-rose-700">
                    Archive <strong>{cat.name}</strong>? It will no longer appear in your dashboard.
                  </p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={handleArchiveConfirm}
                      className="text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => setArchivePendingId(null)}
                      className="text-sm font-medium text-slate-600 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
