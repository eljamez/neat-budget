"use client";

import { useEffect, useRef } from "react";

type Props = {
  running: boolean;
  onComplete: () => void;
};

export function MoneyFlowAnimation({ running, onComplete }: Props) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!running) return;

    const reduced = typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

    const t = setTimeout(() => { onCompleteRef.current(); }, reduced ? 300 : 2000);
    return () => clearTimeout(t);
  }, [running]);

  if (!running) return null;

  const reduced = typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  if (reduced) {
    return (
      <div className="flex justify-center items-center py-2">
        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8l3.5 3.5L13 5" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex justify-center items-center py-4 overflow-hidden" aria-hidden="true">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-teal-500"
            style={{
              animation: `flow-dot 1s ease-in-out infinite`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes flow-dot {
          0%, 100% { transform: translateX(0) scale(1); opacity: 0.4; }
          50% { transform: translateX(12px) scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
