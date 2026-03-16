"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { CategoryManager } from "@/components/CategoryManager";
import { formatCurrency } from "@/lib/utils";

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

  const handleEdit = (cat: Category) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const handleArchive = async (id: Id<"categories">) => {
    if (confirm("Archive this category? It will no longer appear in your dashboard.")) {
      await archiveCategory({ id });
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditCategory(null);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Budget Categories</h1>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditCategory(null); }}
            className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            + New Category
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">
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
            <div key={i} className="bg-white rounded-xl border border-gray-100 h-16 animate-pulse" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-gray-500 mb-4">No categories yet. Create your first budget category!</p>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Category
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div
              key={cat._id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: cat.color ? `${cat.color}20` : "#6366f120" }}
                >
                  {cat.icon ?? "💰"}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{cat.name}</p>
                  <p className="text-sm text-gray-500">{formatCurrency(cat.monthlyLimit)} / month</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(cat)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleArchive(cat._id)}
                  className="text-sm text-gray-400 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
