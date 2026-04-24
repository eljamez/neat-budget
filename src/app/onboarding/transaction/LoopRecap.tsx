"use client";

type LoopRecapProps = {
  accountName: string;
  accountBalance: number;
  categoryName: string;
  categoryMonthlyTarget: number;
  pendingAmount: number;
};

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 px-3 py-2 text-sm text-stone-500 dark:text-slate-400 whitespace-nowrap">
      {children}
    </span>
  );
}

function Arrow() {
  return (
    <span className="text-stone-300 dark:text-slate-600 text-sm shrink-0" aria-hidden="true">
      →
    </span>
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
    <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 overflow-x-auto pb-1 -mb-1">
      <Chip>
        {accountName} — ${accountBalance.toFixed(2)} available
      </Chip>
      <Arrow />
      <Chip>
        {categoryName} — ${categoryMonthlyTarget.toFixed(2)} funded
      </Chip>
      <Arrow />
      <Chip>
        About to spend: ${pendingAmount > 0 ? pendingAmount.toFixed(2) : "0.00"}
      </Chip>
    </div>
  );
}
