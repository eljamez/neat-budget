"use client";

type TargetDatePickerProps = {
  value: Date;
  onChange: (d: Date) => void;
  minDate?: Date;
};

function toInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TargetDatePicker({ value, onChange, minDate }: TargetDatePickerProps) {
  const min = minDate ? toInputValue(minDate) : toInputValue(new Date());

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split("-").map(Number);
    // Construct date in local time (not UTC)
    onChange(new Date(y, m - 1, d));
  }

  return (
    <input
      type="date"
      value={toInputValue(value)}
      min={min}
      onChange={handleChange}
      className="rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
    />
  );
}
