"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ConnectWalletButton from "./ui/connectWalletButton";
import { useWallet } from "./WalletProvider";
import { Activity, BarChart2, Trophy, Search, X } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Terminal", Icon: Activity },
  { href: "/markets", label: "Markets", Icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", Icon: Activity },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicKey: _ } = useWallet(); // Keep the hook call if needed for re-renders, but ignore value
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  // Update search query when URL changes (e.g. back button)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) {
      params.set("q", searchQuery);
    } else {
      params.delete("q");
    }
    router.push(`/markets?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams);
    params.delete("q");
    router.push(`/markets?${params.toString()}`);
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 h-[64px] flex items-center border-b border-white/5 bg-[#0D0D0D]/80 backdrop-blur-md"
    >
      {/* Logo Section */}
      <Link
        href="/"
        className="flex items-center gap-3 px-8 h-full border-r border-white/5 hover:bg-white/[0.02] transition-colors shrink-0"
      >
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Event Horizon Logo" width={28} height={28} className="object-contain rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] brightness-0 invert" />
          <span className="text-lg font-black tracking-widest text-white uppercase italic">Horizon</span>
        </div>
      </Link>

      {/* Center Nav & Search */}
      <div className="flex-1 flex items-center h-full px-6 gap-8">
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = href === "/" 
                ? pathname === "/" 
                : (pathname === href || pathname.startsWith(href + "/"));
              const marketsActive = href === "/markets" && pathname.startsWith("/markets");
              const active = isActive || marketsActive;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-4 py-2 transition-all rounded-lg ${
                    active
                      ? "text-[#FF8C00] bg-[#FF8C00]/5"
                      : "text-white/40 hover:text-white/80 hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? "animate-pulse" : "opacity-50"}`} />
                  <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{label}</span>
                </Link>
              );
          })}
        </nav>

        {/* Search Bar */}
        <form 
          onSubmit={handleSearch}
          className="relative max-w-md w-full group"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 group-focus-within:text-[#FF8C00] transition-colors" />
          <input 
            type="text"
            placeholder="Search prediction markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/5 rounded-full py-2 pl-10 pr-10 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF8C00]/30 focus:bg-white/[0.05] transition-all"
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-3 h-3 text-white/40" />
            </button>
          )}
        </form>
      </div>

      {/* Right Utility Section */}
      <div className="flex items-center gap-6 px-8 h-full border-l border-white/5 bg-[#0D0D0D]/50 backdrop-blur-sm">
        <ConnectWalletButton />
      </div>
    </motion.header>
  );
}
