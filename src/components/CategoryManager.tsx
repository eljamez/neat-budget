"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import {
  CATEGORY_ICON_MAP,
  CATEGORY_ICON_GROUPS,
  CATEGORY_COLORS,
} from "@/lib/icons";

interface Category {
  _id: Id<"categories">;
  name: string;
  color?: string;
  icon?: string;
}

interface CategoryManagerProps {
  editCategory?: Category | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CategoryManager({ editCategory, onSuccess, onCancel }: CategoryManagerProps) {
  const { user } = useUser();
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);

  const [form, setForm] = useState({
    name: editCategory?.name ?? "",
    color: editCategory?.color ?? CATEGORY_COLORS[0],
    icon: editCategory?.icon ?? "Receipt",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      if (editCategory) {
        await updateCategory({
          id: editCategory._id,
          name: form.name,
          color: form.color,
          icon: form.icon,
        });
      } else {
        await createCategory({
          userId: user.id,
          name: form.name,
          color: form.color,
          icon: form.icon,
        });
      }
      onSuccess?.();
    } catch {
      setError("Failed to save category. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cat-name" className="block text-sm font-medium text-slate-600 mb-1.5">
          Category Name
        </label>
        <input
          id="cat-name"
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Groceries, Rent, Entertainment"
          maxLength={100}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 mb-2" id="icon-label">Icon</p>
        <div
          className="border border-slate-200 rounded-xl overflow-y-auto max-h-48 bg-slate-50 p-2 space-y-3"
          role="group"
          aria-labelledby="icon-label"
        >
          {CATEGORY_ICON_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1 mb-1">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {group.icons.map((iconName) => {
                  const Icon = CATEGORY_ICON_MAP[iconName];
                  const selected = form.icon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setForm({ ...form, icon: iconName })}
                      aria-label={`Select icon: ${iconName}`}
                      aria-pressed={selected}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2 ${
                        selected
                          ? "border-teal-500 bg-teal-50 text-teal-600"
                          : "border-transparent hover:border-slate-300 hover:bg-white text-slate-500"
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-slate-600 mb-2" id="color-label">Color</p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="color-label"
        >
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              aria-label={`Select color ${color}`}
              aria-pressed={form.color === color}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                form.color === color
                  ? "border-slate-700 scale-110 ring-2 ring-offset-1 ring-slate-300"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-xl">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-teal-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-teal-700 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 transition-all"
        >
          {loading ? "Saving..." : editCategory ? "Update Category" : "Create Category"}
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
