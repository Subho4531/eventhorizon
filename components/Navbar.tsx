"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ConnectWalletButton from "./ui/connectWalletButton";
import { useWallet } from "./WalletProvider";
import { Activity, BarChart2, Trophy, Search, X, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

const NAV_ITEMS = [
  { href: "/", label: "Terminal", Icon: Activity },
  { href: "/markets", label: "Markets", Icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
   useWallet(); // Keep the hook call for re-renders
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for enhanced navbar background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      className={`fixed top-0 left-0 right-0 z-50 h-[64px] flex items-center transition-all duration-500 ${
        scrolled
          ? "bg-[#050505]/95 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/[0.04]"
      }`}
    >
      {/* Logo Section */}
      <Link
        href="/"
        className="flex items-center gap-3 px-8 h-full border-r border-white/[0.06] hover:bg-white/[0.02] transition-all duration-300 shrink-0 group"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Image src="/logo.png" alt="Event Horizon Logo" width={26} height={26} className="object-contain rounded-full brightness-0 invert group-hover:brightness-100 group-hover:invert-0 transition-all duration-500" />
            <div className="absolute inset-0 rounded-full bg-[#FF8C00]/0 group-hover:bg-[#FF8C00]/15 transition-all duration-500 scale-100 group-hover:scale-125" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black tracking-[0.25em] text-white uppercase leading-none">Horizon</span>
            <span className="text-[7px] font-semibold tracking-[0.3em] text-white/20 uppercase leading-none mt-0.5">Protocol</span>
          </div>
        </div>
      </Link>

      {/* Center Nav & Search */}
      <div className="flex-1 flex items-center h-full px-6 gap-4">
        <nav className="flex items-center gap-1 bg-white/[0.02] rounded-xl p-1 border border-white/[0.04]">
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
                  className={`relative flex items-center gap-2 px-4 py-2 transition-all duration-300 rounded-lg text-[11px] font-semibold tracking-wide ${
                    active
                      ? "text-white"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 transition-colors duration-300 ${active ? "text-[#FF8C00]" : "opacity-40"}`} />
                  <span>{label}</span>
                  {active && (
                    <motion.div 
                      layoutId="navbar-indicator"
                      className="absolute inset-0 rounded-lg bg-white/[0.06] border border-white/[0.08]"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                </Link>
              );
          })}
        </nav>

        {/* Search Bar */}
        <form 
          onSubmit={handleSearch}
          className={`relative max-w-sm w-full transition-all duration-500 ${
            searchFocused ? "max-w-md" : ""
          }`}
        >
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-all duration-300 ${
            searchFocused ? "text-[#FF8C00]/60 scale-110" : "text-white/15"
          }`} />
          <input 
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={`w-full bg-white/[0.03] border rounded-xl py-2.5 pl-10 pr-10 text-[11px] text-white placeholder:text-white/15 focus:outline-none transition-all duration-500 font-medium ${
              searchFocused 
                ? "border-[#FF8C00]/25 bg-white/[0.05] shadow-[0_0_24px_rgba(255,140,0,0.06),inset_0_1px_2px_rgba(255,140,0,0.03)]" 
                : "border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.04]"
            }`}
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-3 h-3 text-white/30 hover:text-white/60" />
            </button>
          )}
        </form>
      </div>

      {/* Right Utility Section */}
      <div className="flex items-center gap-4 px-8 h-full border-l border-white/[0.06]">
        <ConnectWalletButton />
      </div>
    </motion.header>
  );
}
