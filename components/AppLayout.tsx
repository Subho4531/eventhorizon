"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/components/WalletProvider";
import {
  BarChart2,
  Activity,
  Trophy,
  Shield,
  TrendingUp,
  Zap,
  Clock,
  Star,
} from "lucide-react";
import Navbar from "./Navbar";
import OnboardingModal from "./OnboardingModal";

/* ─── Sidebar nav items ─────────────────────────────────────── */
const MAIN_NAV = [
  { href: "/markets", label: "Markets", Icon: BarChart2, desc: "Browse predictions" },
  { href: "/portfolio", label: "Portfolio", Icon: Activity, desc: "Your positions" },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy, desc: "Top traders" },
];

const SECONDARY_NAV = [
  { href: "/admin", label: "Admin", Icon: Shield, desc: "Manage markets" },
];

/* ─── Category quick-filters shown in markets sidebar ───────── */
const CATEGORIES = [
  { label: "All", color: "text-white/60" },
  { label: "Crypto", color: "text-blue-400" },
  { label: "Finance", color: "text-emerald-400" },
  { label: "Technology", color: "text-purple-400" },
  { label: "Politics", color: "text-amber-400" },
  { label: "Sports", color: "text-rose-400" },
];

function formatKey(key: string) {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey } = useWallet();

  const inMarkets = pathname === "/markets" || pathname.startsWith("/markets/");

  return (
    <>
      <OnboardingModal />
      <Navbar />

      <div className="flex min-h-screen pt-[60px]">
        {/* ── SIDEBAR ── */}
        <aside className="hidden md:flex flex-col w-[220px] border-r border-white/[0.06] bg-black/30 backdrop-blur-xl sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto no-scrollbar shrink-0">
          
          {/* Wallet mini-card */}
          {publicKey ? (
            <div className="mx-3 mt-4 mb-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
              <div className="text-[9px] uppercase tracking-[0.18em] text-white/30 font-bold mb-1.5">
                Connected
              </div>
              <div className="font-mono text-[12px] text-white/70 font-semibold truncate mb-2.5">
                {formatKey(publicKey)}
              </div>
              <div className="flex gap-2 text-[10px]">
                <div className="flex-1 bg-white/[0.04] rounded-lg p-2 text-center">
                  <div className="text-white/30 mb-0.5">Volume</div>
                  <div className="text-white font-bold">—</div>
                </div>
                <div className="flex-1 bg-white/[0.04] rounded-lg p-2 text-center">
                  <div className="text-white/30 mb-0.5">P&amp;L</div>
                  <div className="text-emerald-400 font-bold">—</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-3 mt-4 mb-1 bg-blue-600/[0.08] border border-blue-500/20 rounded-xl p-3">
              <div className="text-[10px] text-blue-400 font-semibold mb-1">Not connected</div>
              <p className="text-[10px] text-white/30 leading-relaxed">
                Connect your Stellar wallet to trade.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="mx-3 my-3 border-t border-white/[0.05]" />

          {/* Main nav */}
          <nav className="px-3 space-y-0.5">
            {MAIN_NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || (href !== "/markets" && pathname.startsWith(href));
              const marketsActive = href === "/markets" && inMarkets;
              const isActive = active || marketsActive;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-blue-600/15 text-white border border-blue-500/20"
                      : "text-white/45 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-blue-400" : "text-white/25"}`} />
                  {label}
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Markets quick-filters — only show on markets routes */}
          <AnimatePresence>
            {inMarkets && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mx-3 mt-4 mb-1 border-t border-white/[0.05] pt-4">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/25 font-bold px-1 mb-2">
                    Categories
                  </div>
                  <div className="space-y-0.5">
                    {CATEGORIES.map(({ label, color }) => (
                      <button
                        key={label}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all hover:bg-white/[0.04] ${color} hover:text-white`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Secondary nav */}
          <div className="mx-3 mb-3 border-t border-white/[0.05] pt-3 space-y-0.5">
            {SECONDARY_NAV.map(({ href, label, Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
                    isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-white/30 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </Link>
              );
            })}

            {/* Testnet badge */}
            <div className="mt-3 px-3 py-2.5 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-[0.15em]">
                  Testnet Live
                </span>
              </div>
              <p className="text-[10px] text-white/25 leading-relaxed">
                ZK-verified predictions on Stellar.
              </p>
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 overflow-x-hidden custom-scrollbar">
          <div className="p-5 md:p-8 max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/[0.06] bg-black/80 backdrop-blur-xl"
      >
        <div className="flex items-center justify-around py-2 px-2">
          {[...MAIN_NAV, ...SECONDARY_NAV].map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all ${
                  isActive ? "text-blue-400" : "text-white/30"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
              </Link>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}
