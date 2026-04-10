"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TransactionForm } from "@/components/TransactionForm";
import { useTransactionModal } from "@/components/TransactionModalProvider";

const CONFETTI_COLORS = [
  "#0d9488", "#14b8a6", "#3b82f6", "#f59e0b",
  "#ec4899", "#10b981", "#f97316", "#6366f1",
];

function seededUnit(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function SuccessBanner() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const pieces = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => {
      const angleJitter = (seededUnit(i + 11) - 0.5) * 22;
      const angle = (i / 20) * 360 + angleJitter;
      const rad = (angle * Math.PI) / 180;
      const dist = 48 + seededUnit(i + 23) * 52;
      return {
        id: i,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        tx: Math.cos(rad) * dist,
        ty: Math.sin(rad) * dist - 15,
        rot: seededUnit(i + 37) * 600 - 300,
        delay: seededUnit(i + 41) * 0.12,
        duration: 0.55 + seededUnit(i + 53) * 0.25,
        w: 6 + seededUnit(i + 67) * 5,
        h: 3 + seededUnit(i + 79) * 3,
      };
    }), []);

  return (
    <div
      className="relative bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-5 flex items-center gap-4 overflow-hidden"
      style={prefersReducedMotion ? undefined : { animation: "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
    >
      {/* Confetti burst */}
      {!prefersReducedMotion && (
        <div className="absolute top-1/2 left-12 pointer-events-none" aria-hidden="true">
          {pieces.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-sm"
              style={{
                backgroundColor: p.color,
                width: p.w,
                height: p.h,
                top: 0,
                left: 0,
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                "--rot": `${p.rot}deg`,
                animation: `confetti-fly ${p.duration}s ease-out ${p.delay}s forwards`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Animated checkmark */}
      <div
        className="relative w-10 h-10 flex-shrink-0"
        style={prefersReducedMotion ? undefined : { animation: "check-circle-in 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
          <circle cx="20" cy="20" r="18" fill="#d1fae5" stroke="#059669" strokeWidth="1.5" />
          <path
            d="M12 20l5.5 5.5L28 14"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="30"
            style={prefersReducedMotion ? undefined : { animation: "draw-check 0.35s ease-out 0.2s forwards", strokeDashoffset: 30 }}
          />
        </svg>
      </div>

      <div>
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">Transaction logged!</p>
        <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">Your budget is up to date.</p>
      </div>
    </div>
  );
}

export default function AddTransactionPage() {
  const { openAddTransaction } = useTransactionModal();
  const [success, setSuccess] = useState(false);

  const handleSuccess = () => {
    setSuccess(false);
    // Force re-mount to replay animations
    setTimeout(() => {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    }, 10);
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium mb-4 flex items-center gap-1 transition-colors"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Add Transaction</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Same fields as the quick modal.{" "}
          <button
            type="button"
            onClick={openAddTransaction}
            className="text-teal-600 dark:text-teal-400 font-medium hover:text-teal-700 dark:hover:text-teal-300 underline-offset-2 hover:underline"
          >
            Open as modal
          </button>
          {" "}instead.
        </p>
      </div>

      <div aria-live="polite" role="status" className="min-h-0">
        {success && <SuccessBanner />}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <TransactionForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
}
