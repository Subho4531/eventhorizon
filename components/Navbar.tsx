"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ConnectWalletButton from "./ui/connectWalletButton";
import { useWallet } from "./WalletProvider";
import { Activity, BarChart2, Trophy, Search, X, Briefcase } from "lucide-react";
import { useState, useEffect } from "react";


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
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Update search query when URL changes
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
    setSearchExpanded(false);
  };

  const isMarketsPage = pathname === "/markets" || pathname.startsWith("/markets/");

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="flex items-center justify-between w-[90%] max-w-5xl rounded-full border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-white/5 pointer-events-auto"
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group ml-2">
            <div className="h-4 w-4 rounded-full bg-indigo-500 animate-pulse flex items-center justify-center relative shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-50" />
            </div>
            <span className="text-sm font-bold tracking-widest text-white uppercase group-hover:text-indigo-400 transition-colors">Horizon</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = href === "/" 
                ? pathname === "/" 
                : (pathname === href || pathname.startsWith(href + "/"));
              
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-2 px-4 py-2 transition-all duration-300 rounded-full text-xs font-medium uppercase tracking-widest ${
                    isActive
                      ? "text-white bg-white/10"
                      : "text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isMarketsPage && (
            <div className="relative flex items-center mr-2">
              <form 
                onSubmit={handleSearch}
                className={`flex items-center transition-all duration-500 overflow-hidden ${
                  searchExpanded ? "w-64 opacity-100 mr-2" : "w-0 opacity-0 mr-0"
                }`}
              >
                <div className="relative w-full">
                  <input 
                    type="text"
                    placeholder="Search markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-full py-2 pl-4 pr-8 text-xs font-medium text-white placeholder:text-neutral-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all backdrop-blur-md"
                  />
                  {searchQuery && (
                    <button 
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </form>
              
              <button
                onClick={() => setSearchExpanded(!searchExpanded)}
                className={`p-2 rounded-full transition-colors ${searchExpanded ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"}`}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          )}
          <ConnectWalletButton />
        </div>
      </motion.nav>
    </div>
  );
}
