"use client";

import { useEffect, useRef, useState } from "react";

type CelebrationState =
  | { active: false }
  | { active: true; intensity: "small" | "medium" | "big"; reducedMotion: boolean };

export function Celebration() {
  const [state, setState] = useState<CelebrationState>({ active: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onCelebrate(e: Event) {
      const detail = (e as CustomEvent).detail as { intensity: "small" | "medium" | "big" };
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ active: true, intensity: detail.intensity, reducedMotion: false });
      runConfetti(detail.intensity);
      const duration = detail.intensity === "big" ? 2200 : detail.intensity === "medium" ? 1200 : 700;
      timerRef.current = setTimeout(() => setState({ active: false }), duration);
    }

    function onReduced(e: Event) {
      const detail = (e as CustomEvent).detail as { intensity: "small" | "medium" | "big" };
      if (timerRef.current) clearTimeout(timerRef.current);
      setState({ active: true, intensity: detail.intensity, reducedMotion: true });
      timerRef.current = setTimeout(() => setState({ active: false }), 900);
    }

    window.addEventListener("celebrate", onCelebrate);
    window.addEventListener("celebrate:reduced", onReduced);
    return () => {
      window.removeEventListener("celebrate", onCelebrate);
      window.removeEventListener("celebrate:reduced", onReduced);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function runConfetti(intensity: "small" | "medium" | "big") {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const count = intensity === "big" ? 80 : intensity === "medium" ? 40 : 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: count }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 200,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 10,
      vy: -(Math.random() * 8 + 4),
      color: ["#0d9488", "#5eead4", "#fbbf24", "#f97316", "#a78bfa"][Math.floor(Math.random() * 5)],
      size: Math.random() * 6 + 3,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      opacity: 1,
    }));

    let frame = 0;
    const maxFrames = intensity === "big" ? 90 : intensity === "medium" ? 55 : 30;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.rotation += p.rotSpeed;
        p.opacity = Math.max(0, 1 - frame / maxFrames);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (frame < maxFrames) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    requestAnimationFrame(draw);
  }

  if (!state.active) return null;

  if (state.reducedMotion) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-3 animate-[fade-in_0.2s_ease-out_both]">
          {state.intensity === "big" && (
            <p className="text-lg font-semibold text-teal-700 dark:text-teal-300">
              That&apos;s the whole loop.
            </p>
          )}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <circle cx="24" cy="24" r="22" fill="#ccfbf1" />
            <path d="M14 24l7 7 13-14" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ strokeDasharray: 30, strokeDashoffset: 0, animation: "draw-check 0.4s ease-out both" }} />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[100] pointer-events-none"
        aria-hidden="true"
      />
      {state.intensity === "big" && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 shadow-xl px-8 py-5 animate-[pop-in_0.3s_cubic-bezier(0.34,1.56,0.64,1)_both]">
            <p className="text-base font-semibold text-teal-700 dark:text-teal-300 text-center">
              That&apos;s the whole loop.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
