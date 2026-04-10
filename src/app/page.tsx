import Link from "next/link";
import Image from "next/image";
import { auth } from "@clerk/nextjs/server";
import { LayoutDashboard, BarChart2, Tag, AlertTriangle, Sparkles, Zap, Shield, ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { HomeAccountHeader } from "@/components/HomeAccountHeader";

export default async function Home() {
  const { userId } = await auth();
  return <LandingPage isSignedIn={!!userId} />;
}

function AppMockup() {
  const categories = [
    { name: "Housing", budget: 1500, spent: 1500, color: "bg-teal-500" },
    { name: "Food & Groceries", budget: 600, spent: 412, color: "bg-teal-400" },
    { name: "Transport", budget: 300, spent: 218, color: "bg-cyan-500" },
    { name: "Entertainment", budget: 200, spent: 247, color: "bg-rose-500", over: true },
  ];

  return (
    <div
      className="w-full max-w-2xl mx-auto"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{ transform: "rotateX(8deg)" }}
      >
        {/* Mockup header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-white/15" />
              <span className="w-3 h-3 rounded-full bg-white/15" />
              <span className="w-3 h-3 rounded-full bg-white/15" />
            </div>
            <span className="text-slate-400 text-xs font-medium ml-2">neatbudget.app/dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span className="text-teal-400 text-xs font-semibold">Live</span>
          </div>
        </div>

        {/* Mockup content */}
        <div className="px-5 py-5">
          {/* Dashboard header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Budget Period</p>
              <h3 className="text-white font-bold text-lg">March 2026</h3>
            </div>
            <div className="text-right">
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Total Budget</p>
              <p className="text-white font-bold text-lg">$2,600</p>
            </div>
          </div>

          {/* Summary chips */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-teal-950/60 border border-teal-800/50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-teal-300 font-bold text-sm">$2,377</p>
              <p className="text-teal-600 text-xs mt-0.5">Spent</p>
            </div>
            <div className="bg-slate-800/60 border border-white/8 rounded-xl px-3 py-2.5 text-center">
              <p className="text-white font-bold text-sm">$223</p>
              <p className="text-slate-500 text-xs mt-0.5">Remaining</p>
            </div>
            <div className="bg-rose-950/60 border border-rose-800/50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-rose-400 font-bold text-sm">1 alert</p>
              <p className="text-rose-700 text-xs mt-0.5">Over budget</p>
            </div>
          </div>

          {/* Category rows */}
          <div className="space-y-3">
            {categories.map((cat) => {
              const pct = Math.min((cat.spent / cat.budget) * 100, 100);
              const isOver = cat.over ?? false;
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${isOver ? "bg-rose-500" : "bg-teal-500"}`}
                      />
                      <span className="text-slate-300 text-sm font-medium">{cat.name}</span>
                      {isOver && (
                        <span className="text-rose-400 text-xs font-semibold bg-rose-950/70 border border-rose-800/50 px-1.5 py-0.5 rounded-full">
                          Over
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-semibold ${isOver ? "text-rose-400" : "text-white"}`}>
                        ${cat.spent}
                      </span>
                      <span className="text-slate-600 text-xs"> / ${cat.budget}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isOver ? "bg-rose-500" : cat.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom fade overlay — blends into slate-950 */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

function LandingPage({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <div className="-m-5 sm:-m-8 bg-slate-950 text-white overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen bg-slate-900 overflow-hidden flex flex-col justify-end">

        {/* Drop any photo into /public/hero.jpg — recommended: 1920×1080, warm workspace/lifestyle */}
        <Image
          src="/hero.jpg"
          alt=""
          aria-hidden="true"
          fill
          className="object-cover"
          priority
        />

        {/* OPTION B: swap the <Image> above for a video background */}
        {/*
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        */}

        {/* Dark gradient overlay — ensures legibility and blends into the next section */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-slate-950 pointer-events-none"
        />

        {/* Logo + wordmark — nav-style header, top-left */}
        <div className="absolute top-6 left-5 sm:left-8 z-10 flex items-center gap-3">
          <LogoMark size={36} />
          <span className="text-white font-bold text-xl tracking-tight">Neat Budget</span>
        </div>

        <HomeAccountHeader isSignedIn={isSignedIn} />

        {/* Bottom-anchored content block */}
        <div className="relative z-10 max-w-5xl mx-auto w-full px-5 sm:px-8 pb-16 sm:pb-24 pt-20">

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-bold text-white leading-[1.05] tracking-tight max-w-2xl mb-5">
            Budget smarter,{" "}
            <span className="text-teal-400">stress less</span>
          </h1>

          {/* Subheadline */}
          <p className="text-white/70 text-lg sm:text-xl max-w-lg mb-10 leading-relaxed">
            Plan recurring bills, buckets, debt and card payments by month, then log real transactions to
            keep balances honest.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-teal-500 active:scale-[0.97] transition-all shadow-lg shadow-teal-900/50"
              >
                <LayoutDashboard size={18} aria-hidden="true" />
                Open dashboard
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-teal-500 active:scale-[0.97] transition-all shadow-lg shadow-teal-900/50"
                >
                  Get Started Free
                  <ArrowRight size={16} />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center justify-center bg-white/15 text-white font-medium px-7 py-3.5 rounded-xl border border-white/25 backdrop-blur-sm hover:bg-white/25 transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── APP PREVIEW ── */}
      <section className="bg-slate-950 px-5 sm:px-8 py-12 sm:py-16">
        <div className="max-w-2xl mx-auto">
          <AppMockup />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-slate-900 px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-14">
            <p className="text-teal-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Everything you need to stay on budget
            </h2>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: BarChart2,
                title: "Month-based funding timeline",
                desc: "Fund recurring bills and buckets for a chosen month, then mark items paid as they settle.",
              },
              {
                icon: Tag,
                title: "Recurring expenses in categories",
                desc: "Group your budget and attach recurring expenses with expected monthly amount and due day.",
              },
              {
                icon: AlertTriangle,
                title: "Buckets, debts, and cards",
                desc: "Track discretionary envelopes and plan monthly paydown for loans and revolving credit cards.",
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group bg-slate-800/50 border border-white/8 rounded-2xl p-6 hover:bg-slate-800/80 hover:border-teal-800/50 transition-all duration-300"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 bg-teal-950 border border-teal-800/60 rounded-xl mb-5 group-hover:bg-teal-900/50 transition-colors">
                  <Icon size={20} className="text-teal-400" />
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="bg-slate-950 border-y border-white/8 px-5 sm:px-8 py-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-0">
          {[
            { icon: Sparkles, label: "No subscription, ever", sub: "Free to use — no trial, no credit card" },
            { icon: Zap, label: "Budgets update instantly", sub: "Log a transaction, see it reflected immediately" },
            { icon: Shield, label: "Your data stays private", sub: "Never sold, never shared with third parties" },
          ].map(({ icon: Icon, label, sub }, i) => (
            <div
              key={label}
              className={`flex flex-col items-center text-center ${
                i > 0 ? "sm:border-l sm:border-white/8" : ""
              } sm:px-8`}
            >
              <div className="inline-flex items-center justify-center w-10 h-10 bg-teal-950/80 border border-teal-800/50 rounded-xl mb-3">
                <Icon size={18} className="text-teal-400" />
              </div>
              <p className="text-white font-bold text-base mb-1">{label}</p>
              <p className="text-slate-500 text-sm">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="relative bg-slate-950 px-5 sm:px-8 py-24 sm:py-32">
        <div className="max-w-xl mx-auto text-center">

          {/* Subtle glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-teal-500/8 blur-3xl rounded-full"
          />

          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-5 relative">
            Ready to take control?
          </h2>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Join and start building better spending habits today — for free.
          </p>
          <Link
            href={isSignedIn ? "/dashboard" : "/sign-up"}
            className="inline-flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold px-8 py-4 rounded-xl hover:bg-teal-500 active:scale-[0.97] transition-all shadow-lg shadow-teal-900/50 text-base"
          >
            {isSignedIn ? (
              <>
                <LayoutDashboard size={18} aria-hidden="true" />
                Open dashboard
              </>
            ) : (
              <>
                Get Started Free
                <ArrowRight size={16} />
              </>
            )}
          </Link>
        </div>
      </section>

      {/* ── PAGE FOOTER ── */}
      <div className="bg-slate-950 border-t border-white/8 px-5 sm:px-8 py-6 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <LogoMark size={20} />
          <span className="text-slate-500 text-sm font-medium">Neat Budget</span>
        </div>
        <p className="text-slate-600 text-xs">
          Your money, organized simply.
        </p>
      </div>

    </div>
  );
}
