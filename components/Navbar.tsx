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
      className="fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center border-b border-white/[0.06] bg-black/70 backdrop-blur-xl"
    >
      {/* Logo */}
      <Link
        href="/markets"
        className="flex items-center gap-2.5 px-5 min-w-[220px] border-r border-white/[0.06] h-full"
      >
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-bold text-white tracking-tight">Event Horizon</div>
          <div className="text-[9px] text-white/35 uppercase tracking-[0.15em] font-semibold mt-0.5">
            ZK Prediction Market
          </div>
        </div>
      </Link>

      {/* Center Nav — always visible */}
      <nav className="flex-1 flex items-center justify-center gap-1 px-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/45 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
        })}
      </nav>

      {/* Right — Admin + Wallet */}
      <div className="flex items-center gap-3 px-5 min-w-[220px] justify-end border-l border-white/[0.06] h-full">
        {publicKey === process.env.NEXT_PUBLIC_ADMIN_ID && (
          <Link
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-widest transition-all ${
              pathname === "/admin"
                ? "bg-white/10 text-white"
                : "text-white/30 hover:text-white hover:bg-white/5"
            }`}
          >
            <Shield className="w-3 h-3" />
            Admin
          </Link>
        )}
        <ConnectWalletButton />
      </div>
    </motion.header>
  );
}
