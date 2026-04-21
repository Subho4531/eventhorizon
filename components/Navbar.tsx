"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWalletButton from "./ui/connectWalletButton";
import { useWallet } from "./WalletProvider";
import { Activity, BarChart2, Trophy, Shield, Zap } from "lucide-react";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", Icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", Icon: Activity },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

export default function Navbar() {
  const pathname = usePathname();
  const { publicKey } = useWallet();

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 h-[64px] flex items-center border-b border-white/5 bg-[#0D0D0D]"
    >
      {/* Logo Section */}
      <Link
        href="/markets"
        className="flex items-center gap-3 px-6 h-full border-r border-white/5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-white flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white animate-pulse" />
          </div>
          <span className="text-xl font-black tracking-tighter text-white">EVENT HORIZON</span>
        </div>
      </Link>

      {/* Center Nav */}
      <nav className="flex-1 flex items-center gap-2 px-6">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-4 py-1.5 transition-all border ${
                  active
                    ? "border-[#FF8C00]/40 bg-[#FF8C00]/5 text-[#FF8C00]"
                    : "border-transparent text-white/30 hover:text-white/60"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "animate-pulse" : "opacity-30"}`} />
                <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
              </Link>
            );
        })}
      </nav>

      {/* Right Utility Section */}
      <div className="flex items-center gap-6 px-6 h-full border-l border-white/5 bg-[#0A0A0A]">
        <ConnectWalletButton />
      </div>
    </motion.header>
  );
}
