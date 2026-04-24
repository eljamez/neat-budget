"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseIso(value) : null;
  const [cursor, setCursor] = useState(() => {
    const d = selected ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const todayIso = toIso(new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  function select(day: number) {
    onChange(toIso(new Date(year, month, day)));
    setOpen(false);
  }

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }

  const displayLabel = selected
    ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Pick a date";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <span className={selected ? "text-foreground" : "text-stone-400 dark:text-slate-500"}>
          {displayLabel}
        </span>
        <CalendarDays className="w-4 h-4 text-stone-400 dark:text-slate-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 bottom-full mb-1 w-72 rounded-2xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-stone-700 dark:text-slate-200">
              {MONTHS[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs text-stone-400 dark:text-slate-500 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
              const iso = toIso(new Date(year, month, day));
              const isSelected = iso === value;
              const isToday = iso === todayIso;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => select(day)}
                  className={[
                    "flex items-center justify-center h-8 w-8 mx-auto rounded-full text-sm transition-colors",
                    isSelected
                      ? "bg-teal-600 text-white font-semibold"
                      : isToday
                      ? "border border-teal-500 text-teal-600 dark:text-teal-400 font-medium"
                      : "hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          {value !== todayIso && (
            <div className="mt-3 pt-3 border-t border-stone-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { onChange(todayIso); setOpen(false); }}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
              >
                Jump to today
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
