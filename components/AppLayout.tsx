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
  Globe,
  Cpu,
  Landmark,
  Dumbbell,
  Layers,
} from "lucide-react";
import Navbar from "./Navbar";
import OnboardingModal from "./OnboardingModal";
import { setActiveMarketCategory } from "./MarketsGrid";

/* ─── Sidebar nav items ─────────────────────────────────────── */
const MAIN_NAV = [
  { href: "/markets", label: "Prediction Markets", Icon: BarChart2, desc: "Browse predictions" },
  { href: "/portfolio", label: "Portfolio", Icon: Activity, desc: "Your positions" },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy, desc: "Top traders" },
];

const SECONDARY_NAV = [
  { href: "/admin", label: "Admin", Icon: Shield, desc: "Manage markets" },
];

/* ─── Category quick-filters shown in markets sidebar ───────── */
const CATEGORIES = [
  { label: "All", Icon: Layers, active: "text-white border-white/20 bg-white/5" },
  { label: "Crypto", Icon: TrendingUp, active: "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5" },
  { label: "Finance", Icon: Landmark, active: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5" },
  { label: "Technology", Icon: Cpu, active: "text-[#2979FF] border-[#2979FF]/30 bg-[#2979FF]/5" },
  { label: "Politics", Icon: Globe, active: "text-[#FFD700] border-[#FFD700]/30 bg-[#FFD700]/5" },
  { label: "Sports", Icon: Dumbbell, active: "text-[#F50057] border-[#F50057]/30 bg-[#F50057]/5" },
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

  function handleCategoryClick(label: string) {
    setActiveCategory(label);
    setActiveMarketCategory(label);
    if (!onMarketsIndex) {
      window.location.href = "/markets";
    }
  }

  return (
    <div className="font-sans bg-[#0D0D0D] text-white">
      <OnboardingModal />
      <Navbar />

      <div className="flex min-h-screen pt-[64px]">
        {/* ── SIDEBAR EVENT HORIZON REDESIGN ── */}
        <aside className="hidden md:flex flex-col w-[240px] border-r border-white/5 bg-[#0D0D0D] sticky top-[64px] h-[calc(100vh-64px)] overflow-y-auto no-scrollbar shrink-0">

          {/* Hardware-styled Wallet Card */}
          <div className="p-4">
            {publicKey ? (
              <div className="relative group">
                <div className="absolute inset-0 bg-[#FF8C00]/5 border border-[#FF8C00]/20 rounded-sm" />
                <div className="relative p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 bg-[#FF8C00] animate-pulse" />
                      <span className="text-[9px] font-black text-[#FF8C00] uppercase tracking-tighter text-shadow-glow">Auth Active</span>
                    </div>
                    <div className="text-[8px] text-white/20 uppercase">Module 01</div>
                  </div>
                  <div className="text-[11px] font-bold text-white/80 tracking-tight break-all">
                    {formatKey(publicKey)}
                  </div>
                </div>
                {/* Decorative scanning line for card */}
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#FF8C00]/30 overflow-hidden">
                  <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 2, repeat: Infinity }} className="w-1/2 h-full bg-[#FF8C00]" />
                </div>
              </div>
            ) : (
              <div className="border border-white/10 bg-white/5 p-3">
                <div className="text-[10px] text-white/40 font-bold mb-1 uppercase tracking-tighter">Status: Disconnected</div>
                <p className="text-[9px] text-white/20 leading-tight">
                  Link required: Please connect Stellar wallet.
                </p>
              </div>
            )}
          </div>

          

          <div className="h-px bg-white/5 mx-4 my-2" />

          {/* Nav Links */}
          <nav className="px-3 space-y-1">
            {MAIN_NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || (href !== "/markets" && pathname.startsWith(href));
              const marketsActive = href === "/markets" && inMarkets;
              const isActive = active || marketsActive;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 transition-all border ${isActive
                      ? "border-[#FF8C00]/30 bg-[#FF8C00]/5 text-[#FF8C00]"
                      : "border-transparent text-white/30 hover:text-white/60 hover:bg-white/[0.02]"
                    }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "animate-pulse" : "opacity-30"}`} />
                  <span className="text-[12px] font-bold uppercase tracking-tighter">{label}</span>
                  {isActive && (
                    <div className="ml-auto w-1 h-1 bg-[#FF8C00]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <AnimatePresence>
            {inMarkets && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="px-3 mt-6"
              >
                <div className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-3 mb-3">
                  Data Filter
                </div>
                <div className="space-y-1">
                  {CATEGORIES.map(({ label, Icon, active: activeStyle }) => {
                    const isSelected = activeCategory === label;
                    return (
                      <button
                        key={label}
                        onClick={() => handleCategoryClick(label)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 text-[11px] font-bold transition-all border ${isSelected
                            ? `${activeStyle}`
                            : `text-white/30 border-transparent hover:bg-white/[0.02] hover:text-white/60`
                          }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0 opacity-40" />
                        <span className="uppercase tracking-tighter">{label}</span>
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
              SECONDARY_NAV.map(({ href, label, Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-2 border ${isActive
                        ? "border-[#FFD700]/30 bg-[#FFD700]/5 text-[#FFD700]"
                        : "border-white/5 text-white/20 hover:text-white/40"
                      }`}
                  >
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
                  </Link>
                );
              })}

            {/* Testnet System Status */}
            <div className="p-3 border border-[#00C853]/20 bg-[#00C853]/5 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1 relative z-10">
                <div className="w-1.5 h-1.5 bg-[#00C853] animate-pulse rounded-full" />
                <span className="text-[9px] text-[#00C853] font-black uppercase tracking-[0.2em]">System Online</span>
              </div>
              <div className="text-[8px] text-white/40 relative z-10 font-bold uppercase tracking-tighter">
                Network: Testnet v4.2
              </div>
              {/* Decorative scan bar */}
              <motion.div
                animate={{ y: [-20, 40] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 left-0 w-full h-[1px] bg-[#00C853]/40 z-0"
              />
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 bg-[#0A0A0A] relative overflow-hidden">
          {/* Subtle background scanlines */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

          <div className="relative z-10 p-6 md:p-10 max-w-[1600px] mx-auto min-h-screen">
            {children}
          </div>
        </main>
        {/* ── MOBILE BOTTOM NAV ── */}
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/5 bg-[#0D0D0D] font-mono"
        >
          <div className="flex items-center justify-around py-3 px-2">
            {[...MAIN_NAV, ...SECONDARY_NAV].map(({ href, label, Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1 transition-all ${isActive ? "text-[#FF8C00]" : "text-white/20"
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
                  <span className="text-[8px] font-black uppercase tracking-tighter">{label}</span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
