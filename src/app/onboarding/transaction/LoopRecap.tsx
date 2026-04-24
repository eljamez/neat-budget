"use client";

type LoopRecapProps = {
  accountName: string;
  accountBalance: number;
  categoryName: string;
  categoryMonthlyTarget: number;
  pendingAmount: number;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-3 py-2">
      <span className="text-xs text-stone-400 dark:text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-stone-700 dark:text-slate-200">{value}</span>
    </div>
  );
}

export function LoopRecap({
  accountName,
  accountBalance,
  categoryName,
  categoryMonthlyTarget,
  pendingAmount,
}: LoopRecapProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row label="Account" value={`${accountName} — $${accountBalance.toFixed(2)} available`} />
      <Row label="Category" value={`${categoryName} — $${categoryMonthlyTarget.toFixed(2)} assigned`} />
      <Row label="Spending" value={`$${pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00"}`} />
    </div>
  );
}
