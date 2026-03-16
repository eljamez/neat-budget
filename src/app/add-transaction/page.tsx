"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TransactionForm } from "@/components/TransactionForm";

export default function AddTransactionPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const handleSuccess = () => {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Transaction</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <p className="text-green-700 font-medium">Transaction added successfully!</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <TransactionForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
