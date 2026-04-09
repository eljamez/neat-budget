"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { useTransactionModal } from "@/components/TransactionModalProvider";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/buckets", label: "Buckets", icon: Boxes },
  { href: "/credit-cards", label: "Cards", icon: CreditCard },
  { href: "/debts", label: "Debts", icon: TrendingDown },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/quick-links", label: "Links", icon: Link2 },
  { href: "/add-transaction", label: "Add", icon: PlusCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { openAddTransaction } = useTransactionModal();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  if (!isSignedIn) return null;
  if (pathname === "/") return null;

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
            <span className="font-bold text-white text-base tracking-tight">Neat Budget</span>
          </Link>
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
                  onClick={openAddTransaction}
                  className={itemClass}
                >
                  <Icon className={iconClass} aria-hidden="true" />
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

        <div className="shrink-0 px-4 py-4 border-t border-white/5 flex items-center gap-3">
          <UserButton />
          <span className="text-sm text-slate-400 truncate">Account</span>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-950 border-b border-white/8 h-14 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-bold text-white text-sm tracking-tight">Neat Budget</span>
        </Link>
        <div className="flex items-center gap-2">
          <UserButton />
          <button
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
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-950 flex flex-col h-full shadow-2xl">
            <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
              <span className="font-bold text-white text-base tracking-tight">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
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
                      className={itemClass}
                    >
                      <Icon className={iconClass} aria-hidden="true" />
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
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-950 border-t border-white/8 flex"
        aria-label="Bottom navigation"
      >
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          const isAdd = href === "/add-transaction";
          const addActive = isAdd && pathname === "/add-transaction";
          const className = cn(
            "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors min-h-[3.5rem]",
            active || addActive ? "text-teal-400" : "text-slate-500 hover:text-slate-300"
          );
          if (isAdd) {
            return (
              <button
                key={href}
                type="button"
                onClick={openAddTransaction}
                className={className}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
