"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/components/WalletProvider";
import {
  BarChart2,
  Activity,
  Trophy,
  Shield,
  TrendingUp,
  Globe,
  Cpu,
  Landmark,
  Dumbbell,
  Layers,
  Briefcase,
  Wifi,
  ChevronRight,
} from "lucide-react";
import Navbar from "./Navbar";
import OnboardingModal from "./OnboardingModal";
import { setActiveMarketCategory } from "./MarketsGrid";
import { Suspense } from "react";

/* ─── Sidebar nav items ─────────────────────────────────────── */
const MAIN_NAV = [
  { href: "/", label: "Terminal", Icon: Activity, desc: "Network Overview" },
  { href: "/markets", label: "Markets", Icon: BarChart2, desc: "Browse predictions" },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase, desc: "Your positions" },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy, desc: "Top traders" },
];

const SECONDARY_NAV = [
  { href: "/admin", label: "Admin", Icon: Shield, desc: "Manage markets" },
];

/* ─── Category quick-filters shown in markets sidebar ───────── */
const CATEGORIES = [
  { label: "All", Icon: Layers, color: "#FFFFFF" },
  { label: "Crypto", Icon: TrendingUp, color: "#FF8C00" },
  { label: "Finance", Icon: Landmark, color: "#00C853" },
  { label: "Technology", Icon: Cpu, color: "#2979FF" },
  { label: "Politics", Icon: Globe, color: "#FFD700" },
  { label: "Sports", Icon: Dumbbell, color: "#F50057" },
];

function formatKey(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [activeCategory, setActiveCategory] = React.useState("All");

  const inMarkets = pathname === "/markets" || pathname.startsWith("/markets/");
  const onMarketsIndex = pathname === "/markets";

  const router = useRouter();

  function handleCategoryClick(label: string) {
    setActiveCategory(label);
    setActiveMarketCategory(label);
    if (!onMarketsIndex) {
      router.push("/markets");
    }
  }

  return (
    <div className="font-sans bg-[#050505] text-white min-h-screen">
      <OnboardingModal />
      <Suspense fallback={<div className="h-[64px] bg-[#050505]" />}>
        <Navbar />
      </Suspense>

      <div className="flex min-h-screen pt-[64px]">
        {/* ── SIDEBAR ── */}
        {!["/", "/portfolio", "/leaderboard"].includes(pathname) && (
          <aside className="hidden md:flex flex-col w-[230px] border-r border-white/[0.05] bg-[#050505] sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto no-scrollbar shrink-0">
          {/* Wallet status */}
          <div className="p-4">
            {publicKey ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#00C853]/20 transition-all duration-300 group/wallet">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <div className="w-1.5 h-1.5 bg-[#00C853] rounded-full" />
                    <div className="absolute inset-0 w-1.5 h-1.5 bg-[#00C853] rounded-full animate-ping opacity-50" />
                  </div>
                  <span className="text-[9px] font-bold text-[#00C853] uppercase tracking-[0.15em]">Connected</span>
                </div>
                <div className="text-[11px] font-medium text-white/40 tracking-tight font-mono group-hover/wallet:text-white/60 transition-colors">
                  {formatKey(publicKey)}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="text-[10px] text-white/25 font-semibold mb-1">Not connected</div>
                <p className="text-[9px] text-white/12 leading-relaxed">
                  Connect your wallet to start trading.
                </p>
              </div>
            )}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent mx-4 my-1" />

          {/* Nav Links */}
          <nav className="px-3 space-y-0.5 py-2">
            {MAIN_NAV.map(({ href, label, Icon, desc }) => {
              const isActive = href === "/" 
                ? pathname === "/" 
                : (pathname === href || pathname.startsWith(href + "/"));
              const marketsActive = href === "/markets" && inMarkets;
              const highlighted = isActive || marketsActive;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group/nav ${highlighted
                      ? "bg-[#FF8C00]/[0.07] text-white"
                      : "text-white/25 hover:text-white/55 hover:bg-white/[0.03]"
                    }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${highlighted ? "bg-[#FF8C00]/15" : "bg-white/[0.03] group-hover/nav:bg-white/[0.05]"}`}>
                    <Icon className={`w-3.5 h-3.5 shrink-0 transition-colors duration-300 ${highlighted ? "text-[#FF8C00]" : "opacity-40 group-hover/nav:opacity-60"}`} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-semibold tracking-wide">{label}</span>
                    <span className="text-[8px] text-white/15 font-medium tracking-wide truncate">{desc}</span>
                  </div>
                  {highlighted && (
                    <ChevronRight className="ml-auto w-3 h-3 text-[#FF8C00]/40" />
                  )}
                </Link>
              );
            })}
          </nav>

          <AnimatePresence>
            {inMarkets && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 mt-2 overflow-hidden"
              >
                <div className="text-[9px] font-bold text-white/12 uppercase tracking-[0.2em] px-3 mb-2 flex items-center gap-2">
                  <div className="w-3 h-px bg-white/10" />
                  Categories
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <div className="space-y-0.5">
                  {CATEGORIES.map(({ label, Icon, color }) => {
                    const isSelected = activeCategory === label;
                    return (
                      <button
                        key={label}
                        onClick={() => handleCategoryClick(label)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-medium transition-all duration-300 rounded-lg ${isSelected
                            ? "bg-white/[0.04] text-white"
                            : "text-white/20 hover:bg-white/[0.02] hover:text-white/45"
                          }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all duration-300 ${isSelected ? "bg-white/[0.06]" : ""}`}>
                          <Icon className="w-3 h-3 shrink-0" style={{ color: isSelected ? color : undefined, opacity: isSelected ? 1 : 0.25 }} />
                        </div>
                        <span>{label}</span>
                        {isSelected && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1" />

          {/* Footer Modules */}
          <div className="p-3 space-y-2">
            {/* Admin Module */}
            {publicKey === process.env.NEXT_PUBLIC_ADMIN_ID &&
              SECONDARY_NAV.map(({ href, label, Icon: _Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${isActive
                        ? "bg-[#FFD700]/[0.08] text-[#FFD700]"
                        : "text-white/15 hover:text-white/30 hover:bg-white/[0.02]"
                      }`}
                  >
                    <_Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[10px] font-semibold tracking-wide">{label}</span>
                  </Link>
                );
              })}

            {/* Network Status */}
            <div className="p-3.5 rounded-xl border border-[#00C853]/10 bg-[#00C853]/[0.02] transition-all duration-300 hover:border-[#00C853]/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="relative">
                  <Wifi className="w-3 h-3 text-[#00C853]/50" />
                </div>
                <span className="text-[9px] text-[#00C853]/60 font-bold uppercase tracking-[0.15em]">Online</span>
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
              </div>
              <div className="text-[8px] text-white/15 font-medium tracking-wider">
                Stellar Testnet • v0.9
              </div>
            </div>
          </div>
        </aside>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 bg-[#050505] relative overflow-hidden">
          {/* Ambient background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#FF8C00]/[0.02] to-transparent rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative z-10 p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen">
            {children}
          </div>
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/[0.06] bg-[#050505]/95 backdrop-blur-2xl"
        >
          <div className="flex items-center justify-around py-3 px-2 max-w-lg mx-auto">
            {MAIN_NAV.map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1.5 transition-all duration-300 px-3 py-1.5 rounded-xl ${isActive ? "text-[#FF8C00]" : "text-white/20"
                    }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? "bg-[#FF8C00]/10" : ""}`}>
                    <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-50"}`} />
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-wider">{label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
