"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Tags,
  Boxes,
  CreditCard,
  TrendingDown,
  Wallet,
  PlusCircle,
  Link2,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { useTransactionModal } from "@/components/TransactionModalProvider";
import { useTheme } from "@/components/providers/ThemeProvider";

function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const btn =
    "w-8 h-8 flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

  return (
    <div
      className={cn(
        "flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 gap-0.5",
        className
      )}
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          btn,
          theme === "light"
            ? "bg-white/15 text-white"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        )}
        aria-label="Use light theme"
        aria-pressed={theme === "light"}
      >
        <Sun className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          btn,
          theme === "dark"
            ? "bg-white/15 text-white"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        )}
        aria-label="Use dark theme"
        aria-pressed={theme === "dark"}
      >
        <Moon className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("system")}
        className={cn(
          btn,
          theme === "system"
            ? "bg-white/15 text-white"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        )}
        aria-label="Use system theme"
        aria-pressed={theme === "system"}
      >
        <Monitor className="w-4 h-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/buckets", label: "Buckets", icon: Boxes },
  { href: "/credit-cards", label: "Cards", icon: CreditCard },
  { href: "/debts", label: "Debts", icon: TrendingDown },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/quick-links", label: "Links", icon: Link2 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/add-transaction", label: "Add", icon: PlusCircle },
];

// Primary bottom-nav tabs: Dashboard, Categories, [Add FAB], Buckets, More
const PRIMARY_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/categories", label: "Categories", icon: Tags },
  // Add Transaction is rendered separately as the center FAB
  { href: "/buckets", label: "Buckets", icon: Boxes },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSignedIn, userId } = useAuth();
  const { openAddTransaction } = useTransactionModal();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCreatingBudget, setIsCreatingBudget] = useState(false);
  const [newBudgetName, setNewBudgetName] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpenRef = useRef(false);
  const budgets = useQuery(api.budgets.list, userId ? { userId } : "skip");
  const ensureDefaultBudget = useMutation(api.budgets.ensureDefault);
  const setActiveBudget = useMutation(api.budgets.setActive);
  const createBudget = useMutation(api.budgets.create);

  useEffect(() => {
    if (!userId) return;
    void ensureDefaultBudget({ userId });
  }, [ensureDefaultBudget, userId]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // Focus management for mobile drawer
  useEffect(() => {
    if (!drawerOpen) {
      if (prevOpenRef.current) menuButtonRef.current?.focus();
      prevOpenRef.current = false;
      return;
    }
    prevOpenRef.current = true;
    const drawerEl = document.getElementById("mobile-nav-drawer");
    if (!drawerEl) return;
    const sel = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const getFocusable = () => Array.from(drawerEl.querySelectorAll<HTMLElement>(sel));
    requestAnimationFrame(() => getFocusable()[0]?.focus());
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = getFocusable();
      if (!els.length) return;
      if (e.shiftKey) {
        if (document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1]?.focus(); }
      } else {
        if (document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0]?.focus(); }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [drawerOpen]);

  if (!isSignedIn) return null;
  if (pathname === "/") return null;

  const activeBudgetId = budgets?.find((b) => b.isActive)?._id ?? "";

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden lg:flex w-60 h-screen max-h-screen shrink-0 sticky top-0 self-start flex-col overflow-hidden bg-slate-950"
        aria-label="Main navigation"
      >
        <div className="shrink-0 px-5 py-6 border-b border-white/5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="font-heading font-bold text-white text-base tracking-tight">Neat Budget</span>
          </Link>
          <div className="mt-4">
            <label htmlFor="budget-select-desktop" className="block text-xs text-slate-400 mb-1">
              Budget
            </label>
            <select
              id="budget-select-desktop"
              value={activeBudgetId}
              onChange={(e) => {
                if (!userId || !e.target.value) return;
                void setActiveBudget({ userId, budgetId: e.target.value as Id<"budgets"> });
              }}
              className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              {(budgets ?? []).map((budget) => (
                <option key={budget._id} value={budget._id} className="text-slate-900">
                  {budget.name}
                </option>
              ))}
            </select>
            {isCreatingBudget ? (
              <form
                className="mt-2 flex flex-col gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newBudgetName.trim() || !userId) return;
                  void (async () => {
                    const budgetId = await createBudget({ userId, name: newBudgetName.trim() });
                    await setActiveBudget({ userId, budgetId });
                    setIsCreatingBudget(false);
                    setNewBudgetName("");
                  })();
                }}
              >
                <input
                  autoFocus
                  type="text"
                  value={newBudgetName}
                  onChange={(e) => setNewBudgetName(e.target.value)}
                  placeholder="Budget name"
                  maxLength={80}
                  aria-label="New budget name"
                  className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
                <div className="flex gap-1.5">
                  <button type="submit" className="flex-1 rounded-md bg-teal-600 px-2 py-1 text-xs font-medium text-white hover:bg-teal-500">
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsCreatingBudget(false); setNewBudgetName(""); }}
                    className="flex-1 rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsCreatingBudget(true)}
                className="mt-2 text-xs text-teal-300 hover:text-teal-200"
              >
                + New budget
              </button>
            )}
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-0.5">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            const isAdd = href === "/add-transaction";
            const addActive = isAdd && pathname === "/add-transaction";
            const itemClass = cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left",
              active || addActive
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/8"
            );
            const iconClass = cn(
              "w-4 h-4 flex-shrink-0",
              active || addActive ? "text-white" : "text-slate-500"
            );

            if (isAdd) {
              return (
                <button
                  key={href}
                  type="button"
                  onClick={() => openAddTransaction()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 w-full text-left text-white bg-white/10 ring-1 ring-white/15 hover:bg-white/15 active:scale-[0.97] mt-1"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-teal-400" aria-hidden="true" />
                  Add Transaction
                </button>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={itemClass}
              >
                <Icon className={iconClass} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 px-4 py-4 border-t border-white/5 flex flex-col gap-3">
          <ThemeToggle className="self-start" />
          <div className="flex items-center gap-3 min-w-0">
            <UserButton />
            <span className="text-sm text-slate-400 truncate">Account</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header role="banner" className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950 border-b border-white/8 h-14 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-bold text-white text-sm tracking-tight">Neat Budget</span>
        </Link>
        <div className="flex items-center gap-2">
          <UserButton />
          <button
            ref={menuButtonRef}
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          id="mobile-nav-drawer"
        >
          <div
            className="absolute inset-0 bg-black/60 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="animate-slide-in-left relative w-72 max-w-[85vw] bg-slate-950 flex flex-col h-full shadow-2xl">
            {/* Drawer header */}
            <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between gap-2">
              <span className="font-bold text-white text-base tracking-tight">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 py-4 border-b border-white/5">
              <label htmlFor="budget-select-mobile" className="block text-xs text-slate-400 mb-1">
                Budget
              </label>
              <select
                id="budget-select-mobile"
                value={activeBudgetId}
                onChange={(e) => {
                  if (!userId || !e.target.value) return;
                  void setActiveBudget({ userId, budgetId: e.target.value as Id<"budgets"> });
                }}
                className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                {(budgets ?? []).map((budget) => (
                  <option key={budget._id} value={budget._id} className="text-slate-900">
                    {budget.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Drawer nav */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                const isAdd = href === "/add-transaction";
                const addActive = isAdd && pathname === "/add-transaction";
                const itemClass = cn(
                  "flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-medium transition-all w-full text-left",
                  active || addActive
                    ? "bg-teal-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/8"
                );
                const iconClass = cn(
                  "w-5 h-5 flex-shrink-0",
                  active || addActive ? "text-white" : "text-slate-500"
                );

                if (isAdd) {
                  return (
                    <button
                      key={href}
                      type="button"
                      onClick={() => {
                        openAddTransaction();
                        setDrawerOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-150 w-full text-left text-white bg-white/10 ring-1 ring-white/15 hover:bg-white/15 active:scale-[0.97] mt-1"
                    >
                      <Icon className="w-5 h-5 flex-shrink-0 text-teal-400" aria-hidden="true" />
                      Add Transaction
                    </button>
                  );
                }

                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={itemClass}
                  >
                    <Icon className={iconClass} aria-hidden="true" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Drawer footer: theme toggle */}
            <div className="shrink-0 px-5 py-5 border-t border-white/5 flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-slate-400">Theme</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      {/*
        5-slot layout: [Home] [Categories] [Add FAB] [Buckets] [More]
        Add is a raised teal FAB in the center slot.
      */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-950 border-t border-white/8 flex pb-[env(safe-area-inset-bottom)]"
        aria-label="Bottom navigation"
      >
        {/* Slot 1 & 2: primary nav items before Add */}
        {PRIMARY_NAV.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[3.5rem]",
                active ? "text-teal-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Center slot: Add Transaction FAB */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 min-h-[3.5rem]">
          <button
            type="button"
            onClick={openAddTransaction}
            aria-label="Add transaction"
            className="w-12 h-12 rounded-full bg-teal-500 hover:bg-teal-400 active:bg-teal-600 flex items-center justify-center shadow-lg shadow-teal-900/40 transition-colors -translate-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <PlusCircle className="w-6 h-6 text-white" aria-hidden="true" />
          </button>
          <span className="text-[10px] font-medium text-slate-500 -mt-2">Add</span>
        </div>

        {/* Slot 4: Buckets */}
        {PRIMARY_NAV.slice(2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[3.5rem]",
                active ? "text-teal-400" : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Slot 5: More (opens drawer) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="More navigation options"
          aria-expanded={drawerOpen}
          aria-controls="mobile-nav-drawer"
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[3.5rem]",
            // Highlight "More" when the active page isn't in the primary nav
            !PRIMARY_NAV.some((n) => n.href === pathname) && pathname !== "/add-transaction"
              ? "text-teal-400"
              : "text-slate-500 hover:text-slate-300"
          )}
        >
          <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
