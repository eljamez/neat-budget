"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatCurrency } from "@/lib/utils";

const CATEGORY_ICONS = ["💰", "🏠", "🚗", "🍔", "🎮", "✈️", "👕", "💊", "📚", "🎵", "💅", "🐾", "🏋️", "☕", "🎁"];
const CATEGORY_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];

interface Category {
  _id: Id<"categories">;
  name: string;
  monthlyLimit: number;
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
    monthlyLimit: editCategory?.monthlyLimit?.toString() ?? "",
    color: editCategory?.color ?? CATEGORY_COLORS[0],
    icon: editCategory?.icon ?? CATEGORY_ICONS[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const limit = parseFloat(form.monthlyLimit);
    if (isNaN(limit) || limit <= 0) {
      setError("Please enter a valid budget limit");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (editCategory) {
        await updateCategory({
          id: editCategory._id,
          name: form.name,
          monthlyLimit: limit,
          color: form.color,
          icon: form.icon,
        });
      } else {
        await createCategory({
          userId: user.id,
          name: form.name,
          monthlyLimit: limit,
          color: form.color,
          icon: form.icon,
        });
      }
      onSuccess?.();
    } catch (err) {
      setError("Failed to save category. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Groceries, Rent, Entertainment"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monthly Limit ($)
        </label>
        <input
          type="number"
          step="1"
          min="1"
          value={form.monthlyLimit}
          onChange={(e) => setForm({ ...form, monthlyLimit: e.target.value })}
          placeholder="500"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Icon</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              onClick={() => setForm({ ...form, icon })}
              className={`text-xl p-1.5 rounded-lg border-2 transition-all ${
                form.icon === icon
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-transparent hover:border-gray-200"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
        <div className="flex gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                form.color === color ? "border-gray-800 scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving..." : editCategory ? "Update Category" : "Create Category"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
